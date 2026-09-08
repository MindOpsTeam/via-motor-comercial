/**
 * broadcast-processor — dispara campanhas em lote.
 *
 * Fusão das duas versões (doador A e doador B, ~480 linhas cada). O doador B
 * era mais novo; o doador A tinha a rotação de mídia, que veio junto.
 *
 * O que mudou de verdade: o envio saiu daqui. As duas versões chamavam o
 * provedor direto, dentro do laço, com o próprio `sleep` entre mensagens — o
 * que significa que uma execução que estourasse o tempo limite deixava metade
 * do lote sem saber se tinha ido ou não, e a reexecução mandava de novo.
 *
 * Agora o processador só enfileira, com uma chave por destinatário. O ritmo
 * vira `scheduled_at` escalonado e quem entrega é o `send-worker`. Reexecutar
 * a mesma campanha não duplica nada: a chave `campaign:<id>:<contato>` já está
 * na fila.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { authenticateCronRequest } from '../_shared/cron-auth.ts';
import { corsHeaders, enqueueSend, json } from '../_shared/flow.ts';

// deno-lint-ignore no-explicit-any
type Service = any;

interface Campaign {
  id: string;
  workspace_id: string;
  name: string;
  status: string;
  list_id: string | null;
  channel_id: string | null;
  message_type: string;
  message_template: string | null;
  media_urls: string[] | null;
  media_rotation_mode: string | null;
  batch_size: number;
  delay_min_ms: number;
  delay_max_ms: number;
  sent_count: number;
  failed_count: number;
}

function aplicarVariaveis(texto: string, vars: Record<string, string>): string {
  return texto.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, chave) => vars[chave] ?? '');
}

/**
 * Rotação de mídia (herdada do doador A): alternar a imagem entre destinatários
 * reduz a chance de o provedor tratar o lote como conteúdo repetido em massa.
 */
function escolherMidia(urls: string[] | null, modo: string | null, indice: number): string | null {
  if (!urls?.length) return null;
  if (modo === 'random') return urls[Math.floor(Math.random() * urls.length)];
  return urls[indice % urls.length];
}

async function processar(service: Service, campanha: Campaign): Promise<{ enfileirados: number; concluida: boolean }> {
  const { data: pendentes, error } = await service
    .from('broadcast_recipients')
    .select('id, contact_id, variables')
    .eq('campaign_id', campanha.id)
    .eq('status', 'pending')
    .limit(campanha.batch_size || 50);
  if (error) throw new Error(`destinatários: ${error.message}`);

  const lote = pendentes ?? [];
  if (lote.length === 0) {
    await service.from('broadcast_campaigns')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', campanha.id);
    return { enfileirados: 0, concluida: true };
  }

  const minDelay = campanha.delay_min_ms || 3000;
  const maxDelay = campanha.delay_max_ms || 8000;
  let acumulado = 0;
  let enfileirados = 0;

  for (let i = 0; i < lote.length; i++) {
    const destinatario = lote[i];
    try {
      const { data: contato } = await service
        .from('contacts')
        .select('name, is_blocked')
        .eq('id', destinatario.contact_id)
        .single();

      if (contato?.is_blocked) {
        await service.from('broadcast_recipients')
          .update({ status: 'skipped', error_message: 'contato bloqueado' })
          .eq('id', destinatario.id);
        continue;
      }

      const conteudo = aplicarVariaveis(campanha.message_template ?? '', {
        nome: contato?.name ?? '',
        primeiro_nome: (contato?.name ?? '').split(' ')[0] ?? '',
        ...(destinatario.variables ?? {}),
      });

      // O ritmo vira agendamento, não sleep: a função não precisa ficar viva
      // esperando, e um timeout no meio do lote não perde o resto.
      acumulado += minDelay + Math.floor(Math.random() * Math.max(1, maxDelay - minDelay));
      const midia = escolherMidia(campanha.media_urls, campanha.media_rotation_mode, i);

      const filaId = await enqueueSend(service, {
        workspaceId: campanha.workspace_id,
        contactId: destinatario.contact_id,
        content: conteudo,
        origin: 'campaign',
        dedupeKey: `campaign:${campanha.id}:${destinatario.contact_id}`,
        originId: campanha.id,
        messageType: campanha.message_type || 'text',
        mediaUrl: midia,
        scheduledAt: new Date(Date.now() + acumulado).toISOString(),
        channelId: campanha.channel_id,
      });

      if (filaId === null) {
        await service.from('broadcast_recipients')
          .update({ status: 'skipped', error_message: 'contato bloqueado' })
          .eq('id', destinatario.id);
        continue;
      }

      await service.from('broadcast_recipients')
        .update({ status: 'queued', sent_media_url: midia })
        .eq('id', destinatario.id);
      enfileirados++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await service.from('broadcast_recipients')
        .update({ status: 'failed', error_message: message.slice(0, 300) })
        .eq('id', destinatario.id);
      console.error(`[broadcast-processor] destinatário ${destinatario.id}: ${message}`);
    }
  }

  await service.from('broadcast_campaigns').update({
    status: 'running',
    sent_count: (campanha.sent_count ?? 0) + enfileirados,
    next_batch_at: new Date(Date.now() + acumulado + 5000).toISOString(),
    started_at: campanha.status === 'draft' ? new Date().toISOString() : undefined,
  }).eq('id', campanha.id);

  return { enfileirados, concluida: false };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  // Aceita disparo manual autenticado por JWT e disparo por cron.
  const porCron = req.headers.get('x-cron') === 'true';
  if (porCron) {
    const naoAutorizado = authenticateCronRequest(req);
    if (naoAutorizado) return naoAutorizado;
  }

  const service = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    let campanhaId: string | null = null;
    try {
      const body = await req.json();
      campanhaId = body?.campaign_id ?? null;
    } catch { /* cron chama sem corpo */ }

    let query = service
      .from('broadcast_campaigns')
      .select('id, workspace_id, name, status, list_id, channel_id, message_type, message_template, media_urls, media_rotation_mode, batch_size, delay_min_ms, delay_max_ms, sent_count, failed_count');

    if (campanhaId) {
      query = query.eq('id', campanhaId);
    } else {
      query = query
        .in('status', ['scheduled', 'running'])
        .or(`next_batch_at.is.null,next_batch_at.lte.${new Date().toISOString()}`)
        .limit(5);
    }

    const { data: campanhas, error } = await query;
    if (error) throw new Error(`campanhas: ${error.message}`);

    let total = 0;
    for (const campanha of (campanhas ?? []) as Campaign[]) {
      const resultado = await processar(service, campanha);
      total += resultado.enfileirados;
      console.log(`[broadcast-processor] ${campanha.name}: ${resultado.enfileirados} enfileirados${resultado.concluida ? ' (concluída)' : ''}`);
    }

    return json({ campanhas: campanhas?.length ?? 0, enfileirados: total });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[broadcast-processor] ${message}`);
    return json({ error: message }, 500);
  }
});
