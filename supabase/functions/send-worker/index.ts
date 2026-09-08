/**
 * send-worker — o consumidor único de `send_queue`.
 *
 * Substitui três funções que faziam a mesma coisa por caminhos diferentes:
 *   send-evolution-message (doador A) · send-meta-message (doador B) ·
 *   whatsapp-sender (trunk)
 *
 * Campanha, cadência, fluxo, inbox e agente enfileiram. Este worker é o único
 * que fala com provedor. Isso é o que torna possível responder "por que essa
 * mensagem não saiu?" olhando uma tabela só.
 *
 * Idempotência em três camadas:
 *   1. `claim_send_queue_batch` marca a linha como `processing` com FOR UPDATE
 *      SKIP LOCKED — dois workers simultâneos não pegam a mesma linha.
 *   2. `provider_message_id` tem índice único por workspace: se a entrega saiu
 *      mas a marcação falhou, a retentativa não gera segunda mensagem.
 *   3. A linha só volta para `pending` enquanto houver tentativa sobrando.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, json } from '../_shared/flow.ts';
import { deliver, resolveChannel, type ResolvedChannel } from '../_shared/channel.ts';

const MAX_RETRIES = 3;
const BATCH_SIZE = 10;

interface QueueRow {
  id: string;
  workspace_id: string;
  conversation_id: string;
  contact_id: string;
  content: string | null;
  media_url: string | null;
  message_type: string;
  channel_id: string | null;
  message_id: string | null;
  retry_count: number;
  origin: string | null;
  created_at: string;
  metadata: Record<string, unknown> | null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const service = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    const { data: batch, error } = await service.rpc('claim_send_queue_batch', { p_limit: BATCH_SIZE });
    if (error) throw new Error(`claim_send_queue_batch: ${error.message}`);

    const rows = (batch ?? []) as QueueRow[];
    if (rows.length === 0) return json({ processed: 0, sent: 0, failed: 0 });

    // Um cache por execução: um lote de campanha costuma sair todo pelo mesmo
    // canal, e resolver credencial por linha seria uma consulta por mensagem.
    const channels = new Map<string, ResolvedChannel>();
    let sent = 0;
    let failed = 0;

    for (const row of rows) {
      try {
        const { data: contact, error: contactError } = await service
          .from('contacts')
          .select('phone_e164, is_blocked, name')
          .eq('id', row.contact_id)
          .single();
        if (contactError) throw new Error(`contato: ${contactError.message}`);

        // O bloqueio pode ter chegado depois do enfileiramento. Verificar aqui é
        // a última porta antes de a mensagem sair de fato.
        if (contact.is_blocked) {
          await service.from('send_queue')
            .update({ status: 'failed', error_message: 'cancelado: contato bloqueado' })
            .eq('id', row.id);
          failed++;
          continue;
        }

        // `flow_ingest_inbound` cancela os envios que ainda estão em `pending`
        // quando o lead responde. Mas se a resposta chegar no intervalo entre o
        // claim e a entrega, a linha já saiu de `pending` e escapa daquele
        // cancelamento — e o lead recebe um follow-up automático segundos depois
        // de ter respondido, que é a pior hora possível para isso acontecer.
        //
        // A janela é de segundos, mas é justamente a janela em que o lead está
        // com o telefone na mão. Aqui é a última chance de fechá-la.
        if (row.origin === 'followup' || row.origin === 'campaign') {
          const { data: resposta } = await service
            .from('messages')
            .select('id')
            .eq('conversation_id', row.conversation_id)
            .eq('from_type', 'user')
            .gt('sent_at', row.created_at)
            .limit(1);

          if (resposta?.length) {
            await service.from('send_queue')
              .update({ status: 'failed', error_message: 'cancelado: lead respondeu antes da entrega' })
              .eq('id', row.id);
            console.log(`[send-worker] ${row.id} cancelado: o lead respondeu depois do enfileiramento`);
            failed++;
            continue;
          }
        }
        if (!contact.phone_e164) throw new Error('contato sem telefone normalizado');

        const cacheKey = `${row.workspace_id}:${row.channel_id ?? 'default'}`;
        let channel = channels.get(cacheKey);
        if (!channel) {
          channel = await resolveChannel(service, row.workspace_id, row.channel_id);
          channels.set(cacheKey, channel);
        }

        const meta = row.metadata ?? {};
        const result = await deliver(channel, {
          phone: contact.phone_e164,
          content: row.content,
          messageType: row.message_type,
          mediaUrl: row.media_url,
          fileName: meta.file_name as string | undefined,
          templateName: meta.template_name as string | undefined,
          templateLanguage: meta.template_language as string | undefined,
          templateVariables: meta.template_variables as Record<string, string[]> | undefined,
        });

        await service.from('send_queue').update({
          status: 'completed',
          sent_at: new Date().toISOString(),
          provider_message_id: result.providerMessageId,
          channel_id: channel.id,
          error_message: null,
        }).eq('id', row.id);

        // A mensagem que o inbox pré-criou sai de 'processing' só quando o
        // provedor confirma. Antes disso ela não foi enviada de verdade.
        if (row.message_id) {
          await service.from('messages').update({
            status: 'sent',
            provider: channel.provider,
            provider_message_id: result.providerMessageId,
            sent_at: new Date().toISOString(),
          }).eq('id', row.message_id);
        }

        sent++;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const attempts = (row.retry_count ?? 0) + 1;
        const esgotou = attempts >= MAX_RETRIES;

        // Falha de provedor não é carta morta: volta para a fila com espera
        // crescente enquanto houver tentativa. Só desiste quando esgota.
        await service.from('send_queue').update({
          status: esgotou ? 'failed' : 'pending',
          retry_count: attempts,
          error_message: message.slice(0, 500),
          scheduled_at: esgotou
            ? undefined
            : new Date(Date.now() + attempts * 60_000).toISOString(),
        }).eq('id', row.id);

        if (esgotou && row.message_id) {
          await service.from('messages').update({ status: 'failed' }).eq('id', row.message_id);
        }

        console.error(`[send-worker] ${row.id} tentativa ${attempts}/${MAX_RETRIES}: ${message}`);
        failed++;
      }
    }

    return json({ processed: rows.length, sent, failed });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[send-worker] ${message}`);
    return json({ error: message }, 500);
  }
});
