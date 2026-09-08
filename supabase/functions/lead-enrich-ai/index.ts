/**
 * lead-enrich-ai — qualifica o decisor com IA e devolve um score.
 *
 * Portado do doador A (1686 linhas → ~180). O original era a maior função do
 * projeto e concentrava quatro responsabilidades: chamar o Apollo de novo,
 * raspar site, chamar o modelo e escrever em `contacts`. Aqui ficou só a
 * terceira — as outras já têm dono no fluxo (`lead-search-execute` traz o dado,
 * `scraping-execute` raspa) e o score tem uma porta com autoridade declarada.
 *
 * A regra de autoridade importa: `contacts.enrichment_score` é escrito
 * exclusivamente por `lead_enrich_apply()`. Antes, três caminhos escreviam o
 * score (esta função, a busca e a tela), e o valor que ficava era o do último
 * que rodou — que é como um lead qualificado voltava a 0 sem ninguém entender.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { applyEnrichment, corsHeaders, json } from '../_shared/flow.ts';

// deno-lint-ignore no-explicit-any
type Service = any;

const LOTE = 20;

interface Avaliacao {
  score: number;
  resumo: string;
  decisor: boolean;
}

/**
 * Uma chamada por contato, com resposta estruturada. O original mandava o lote
 * inteiro num prompt só e reconciliava as respostas por posição no array — o
 * que desalinhava silenciosamente quando o modelo pulava um item, e atribuía o
 * score de um lead ao seguinte.
 */
async function avaliar(apiKey: string, contato: Record<string, unknown>, criterio: string): Promise<Avaliacao | null> {
  const resposta = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        {
          role: 'system',
          content:
            'Você qualifica leads B2B. Responda SOMENTE com a chamada de função, sem texto solto. ' +
            'Score 0-100: quanto o lead se encaixa no critério e quanta alçada de decisão ele tem.',
        },
        {
          role: 'user',
          content: `Critério do cliente: ${criterio}\n\nLead:\n${JSON.stringify(contato, null, 2)}`,
        },
      ],
      tools: [{
        type: 'function',
        function: {
          name: 'qualificar',
          description: 'Devolve a qualificação do lead',
          parameters: {
            type: 'object',
            properties: {
              score: { type: 'number', description: 'De 0 a 100' },
              resumo: { type: 'string', description: 'Uma frase sobre o encaixe' },
              decisor: { type: 'boolean', description: 'Tem alçada para decidir a compra' },
            },
            required: ['score', 'resumo', 'decisor'],
            additionalProperties: false,
          },
        },
      }],
      tool_choice: { type: 'function', function: { name: 'qualificar' } },
    }),
  });

  if (resposta.status === 429) throw new Error('RATE_LIMIT');
  if (resposta.status === 402) throw new Error('SEM_CREDITO');
  if (!resposta.ok) throw new Error(`gateway ${resposta.status}: ${(await resposta.text()).slice(0, 200)}`);

  const dados = await resposta.json();
  const argumentos = dados.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!argumentos) return null;

  try {
    const parsed = JSON.parse(argumentos);
    return {
      score: Math.max(0, Math.min(100, Number(parsed.score) || 0)),
      resumo: String(parsed.resumo ?? ''),
      decisor: Boolean(parsed.decisor),
    };
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const service: Service = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    const { search_id, contact_ids, criterio } = await req.json();
    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!apiKey) throw new Error('LOVABLE_API_KEY ausente no ambiente');

    let alvos: string[] = Array.isArray(contact_ids) ? contact_ids : [];
    let criterioFinal = criterio ?? 'Encaixe geral com um serviço B2B de automação comercial.';

    if (search_id) {
      const { data: busca } = await service
        .from('lead_searches')
        .select('id, workspace_id, config')
        .eq('id', search_id)
        .single();
      if (!busca) throw new Error('Busca não encontrada');
      criterioFinal = criterio ?? (busca.config?.criterio as string) ?? criterioFinal;

      if (alvos.length === 0) {
        // Só o que ainda não tem score: reprocessar o lote inteiro a cada
        // execução era o que fazia o custo do enriquecimento crescer sem limite.
        const { data: pendentes } = await service
          .from('contacts')
          .select('id')
          .eq('workspace_id', busca.workspace_id)
          .is('enrichment_score', null)
          .limit(LOTE);
        alvos = (pendentes ?? []).map((c: { id: string }) => c.id);
      }
    }

    if (alvos.length === 0) return json({ enriquecidos: 0, mensagem: 'Nada pendente' });

    let enriquecidos = 0;
    let falhas = 0;

    for (const contactId of alvos) {
      try {
        const { data: contato } = await service
          .from('contacts')
          .select('id, workspace_id, name, role_title, email, notes, lead_companies(name, industry, employees_count, description, website)')
          .eq('id', contactId)
          .single();
        if (!contato) continue;

        const avaliacao = await avaliar(apiKey, {
          nome: contato.name,
          cargo: contato.role_title,
          notas: contato.notes,
          empresa: contato.lead_companies,
        }, criterioFinal);

        if (!avaliacao) { falhas++; continue; }

        // Porta única do score. A função também marca decisor e escreve a
        // timeline, num bloco só.
        await applyEnrichment(service, contactId, avaliacao.score, {
          resumo: avaliacao.resumo,
          decisor: avaliacao.decisor,
        });

        if (avaliacao.decisor) {
          await service.from('contacts').update({ is_decision_maker: true }).eq('id', contactId);
        }

        enriquecidos++;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        // Limite de taxa e falta de crédito param o lote inteiro: insistir só
        // queima cota. O que sobrou continua sem score e entra no próximo ciclo.
        if (message === 'RATE_LIMIT' || message === 'SEM_CREDITO') {
          console.warn(`[lead-enrich-ai] interrompido: ${message}`);
          break;
        }
        console.error(`[lead-enrich-ai] contato ${contactId}: ${message}`);
        falhas++;
      }
    }

    if (search_id) {
      await service.from('lead_searches')
        .update({ contacts_enriched: enriquecidos, enrich_heartbeat: new Date().toISOString() })
        .eq('id', search_id);
    }

    console.log(`[lead-enrich-ai] ${enriquecidos} enriquecidos, ${falhas} falhas`);
    return json({ enriquecidos, falhas, restantes: Math.max(0, alvos.length - enriquecidos - falhas) });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[lead-enrich-ai] ${message}`);
    return json({ error: message }, 500);
  }
});
