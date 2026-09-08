/**
 * lead-search-execute — busca empresas e decisores no Apollo.
 *
 * Portado do doador A (782 linhas → ~230). É a primeira etapa do fluxo: o que
 * entra aqui é o que o resto do sistema vai trabalhar, e por isso é onde a
 * identidade precisa nascer certa.
 *
 * O que mudou:
 *   • Empresa virou entidade. O original guardava `company` como TEXTO dentro
 *     do contato, então dois decisores da mesma empresa não se conheciam e não
 *     havia como perguntar "quantos contatos eu tenho na Acme?".
 *     Agora `flow_upsert_company()` resolve por domínio ou CNPJ e devolve o
 *     mesmo id — os decisores ficam pendurados na mesma empresa.
 *   • A normalização de telefone saiu do TypeScript. O original tinha um
 *     `normalizeBRPhone` próprio aqui, e outro diferente no webhook — que era
 *     como o mesmo lead entrava duas vezes conforme a porta por onde chegava.
 *     Agora quem normaliza é `normalize_phone()` no banco, uma vez só.
 *   • O upsert de contato passou a ser idempotente por
 *     `(workspace_id, phone_e164)`. Rodar a mesma busca duas vezes enriquece o
 *     que já existe em vez de duplicar.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, json, recordEvent, upsertCompany, upsertContact } from '../_shared/flow.ts';

// deno-lint-ignore no-explicit-any
type Service = any;
// deno-lint-ignore no-explicit-any
type ApolloPerson = any;

const APOLLO_URL = 'https://api.apollo.io/api/v1/mixed_people/api_search';

interface SearchConfig {
  titulos?: string[];
  setores?: string[];
  locais?: string[];
  tamanhos?: string[];
  dominios?: string[];
  volume?: { per_page?: number };
}

function montarBusca(config: SearchConfig, pagina: number) {
  return {
    page: pagina,
    per_page: Math.min(config.volume?.per_page ?? 25, 100),
    ...(config.titulos?.length ? { person_titles: config.titulos } : {}),
    ...(config.locais?.length ? { person_locations: config.locais } : {}),
    ...(config.setores?.length ? { q_organization_keyword_tags: config.setores } : {}),
    ...(config.tamanhos?.length ? { organization_num_employees_ranges: config.tamanhos } : {}),
    ...(config.dominios?.length ? { q_organization_domains: config.dominios.join('\n') } : {}),
  };
}

/**
 * Decisor: quem tem alçada para dizer sim. Marcar isso na entrada evita que o
 * SDR gaste cadência com quem não decide — e é a diferença entre uma lista de
 * contatos e uma lista de oportunidades.
 */
function ehDecisor(titulo: string | null): boolean {
  if (!titulo) return false;
  return /\b(ceo|cto|cfo|coo|cmo|founder|owner|s[oó]cio|presidente|diretor|director|head|gerente|manager|vp|vice.?president|propriet[aá]rio)\b/i
    .test(titulo);
}

async function buscarApollo(apiKey: string, config: SearchConfig, pagina: number): Promise<ApolloPerson[]> {
  const resposta = await fetch(APOLLO_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache', 'x-api-key': apiKey },
    body: JSON.stringify(montarBusca(config, pagina)),
  });

  if (!resposta.ok) {
    const texto = await resposta.text();
    throw new Error(`Apollo ${resposta.status}: ${texto.slice(0, 300)}`);
  }
  const dados = await resposta.json();
  return [...(dados.people ?? []), ...(dados.contacts ?? [])];
}

async function gravarPessoa(service: Service, workspaceId: string, searchId: string, pessoa: ApolloPerson) {
  const org = pessoa.organization ?? {};
  const nomeEmpresa: string | null = org.name ?? pessoa.organization_name ?? null;

  let companyId: string | null = null;
  if (nomeEmpresa) {
    companyId = await upsertCompany(service, {
      workspaceId,
      name: nomeEmpresa,
      domain: org.primary_domain ?? org.website_url?.replace(/^https?:\/\/(www\.)?/, '').split('/')[0] ?? null,
      searchId,
      data: {
        website: org.website_url ?? null,
        linkedin_url: org.linkedin_url ?? null,
        industry: org.industry ?? null,
        description: org.short_description ?? null,
        employees_count: org.estimated_num_employees != null ? String(org.estimated_num_employees) : null,
        revenue: org.annual_revenue_printed ?? null,
        founding_year: org.founded_year != null ? String(org.founded_year) : null,
        city: org.city ?? pessoa.city ?? null,
        phone: org.primary_phone?.number ?? null,
        apollo_org_id: org.id ?? null,
      },
    });
  }

  const telefone: string | null =
    pessoa.phone_numbers?.[0]?.raw_number ?? pessoa.sanitized_phone ?? pessoa.organization?.primary_phone?.number ?? null;
  const email: string | null = pessoa.email && !String(pessoa.email).includes('email_not_unlocked') ? pessoa.email : null;

  // Sem telefone nem e-mail não há como identificar a pessoa — e um contato sem
  // chave natural é exatamente a linha que vira duplicata depois.
  if (!telefone && !email) return { contactId: null, companyId };

  const nome = [pessoa.first_name, pessoa.last_name].filter(Boolean).join(' ') || pessoa.name || 'Sem nome';

  const contactId = await upsertContact(service, {
    workspaceId,
    name: nome,
    phone: telefone,
    email,
    companyId,
    roleTitle: pessoa.title ?? null,
    isDecisionMaker: ehDecisor(pessoa.title ?? null),
    source: 'apollo',
    data: {
      tags: ['lead-search'],
      notes: pessoa.headline ?? null,
    },
  });

  return { contactId, companyId };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const service = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  let searchId: string | null = null;

  try {
    const body = await req.json();
    searchId = body.search_id;
    if (!searchId) throw new Error('search_id é obrigatório');

    const apiKey = Deno.env.get('APOLLO_API_KEY');
    if (!apiKey) throw new Error('APOLLO_API_KEY ausente no ambiente');

    const { data: busca, error: buscaError } = await service
      .from('lead_searches')
      .select('id, workspace_id, name, config, target_list_id, status')
      .eq('id', searchId)
      .single();
    if (buscaError || !busca) throw new Error('Busca não encontrada');

    const inicio = Date.now();
    await service.from('lead_searches')
      .update({ status: 'running', started_at: new Date().toISOString(), error_message: null })
      .eq('id', searchId);

    const config = (busca.config ?? {}) as SearchConfig;
    const desejados = config.volume?.per_page ?? 25;

    let encontrados = 0;
    const contatosDaBusca: string[] = [];
    const empresas = new Set<string>();

    // Quantos contatos o workspace tinha antes. Medir uma vez no começo e uma
    // no fim dá o número de novos sem pagar duas consultas por pessoa — e sem
    // a leitura suja que dois COUNT dentro do laço produziriam se outra busca
    // estivesse rodando ao mesmo tempo.
    const { count: antesDaBusca } = await service
      .from('contacts')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', busca.workspace_id);

    for (let pagina = 1; pagina <= 5 && contatosDaBusca.length < desejados; pagina++) {
      const pessoas = await buscarApollo(apiKey, config, pagina);
      if (pessoas.length === 0) break;
      encontrados += pessoas.length;

      for (const pessoa of pessoas) {
        if (contatosDaBusca.length >= desejados) break;
        try {
          const { contactId, companyId } = await gravarPessoa(service, busca.workspace_id, searchId, pessoa);
          if (!contactId) continue;

          contatosDaBusca.push(contactId);
          if (companyId) empresas.add(companyId);
        } catch (err) {
          console.error(`[lead-search-execute] pessoa: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }

    const { count: depoisDaBusca } = await service
      .from('contacts')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', busca.workspace_id);
    const novos = Math.max(0, (depoisDaBusca ?? 0) - (antesDaBusca ?? 0));

    // Lista de destino: a busca entrega direto para a cadência trabalhar.
    if (busca.target_list_id && contatosDaBusca.length) {
      await service.from('contact_list_members').upsert(
        contatosDaBusca.map((contactId) => ({
          workspace_id: busca.workspace_id,
          list_id: busca.target_list_id,
          contact_id: contactId,
        })),
        { onConflict: 'list_id,contact_id', ignoreDuplicates: true },
      );
    }

    for (const contactId of contatosDaBusca) {
      await recordEvent(service, {
        workspaceId: busca.workspace_id,
        contactId,
        stage: 'prospeccao',
        eventType: 'encontrado_na_busca',
        title: `Encontrado na busca "${busca.name}"`,
        detail: { search_id: searchId },
        dedupeKey: `busca:${searchId}:${contactId}`,
      });
    }

    await service.from('lead_searches').update({
      status: 'completed',
      contacts_found: encontrados,
      contacts_new: novos,
      completed_at: new Date().toISOString(),
      duration_ms: Date.now() - inicio,
      result_data: { empresas: empresas.size, contatos: contatosDaBusca.length },
    }).eq('id', searchId);

    console.log(`[lead-search-execute] ${busca.name}: ${empresas.size} empresas, ${contatosDaBusca.length} decisores (${novos} novos)`);
    return json({
      encontrados,
      contatos: contatosDaBusca.length,
      novos,
      empresas: empresas.size,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[lead-search-execute] ${message}`);
    if (searchId) {
      await service.from('lead_searches')
        .update({ status: 'failed', error_message: message.slice(0, 500), completed_at: new Date().toISOString() })
        .eq('id', searchId);
    }
    return json({ error: message }, 500);
  }
});
