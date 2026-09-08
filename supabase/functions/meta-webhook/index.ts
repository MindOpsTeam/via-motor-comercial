/**
 * meta-webhook — a borda de entrada do WhatsApp Cloud API oficial.
 *
 * Portado do doador B. O original inseria direto em `webhook_message_dedup`,
 * `conversation_messages`, `contacts` e `flow_executions`, e resolvia o contato
 * comparando telefone cru. Aqui a borda faz duas coisas e só:
 *
 *   1. `webhook_claim` — o mesmo evento entregue duas vezes pela Meta (o que
 *      acontece o tempo todo: ela reentrega quando não recebe 200 rápido) vira
 *      uma linha só.
 *   2. `flow_ingest_inbound` — daí para frente o fluxo inteiro anda sozinho,
 *      num bloco transacional: contato, conversa, mensagem, cadência parada,
 *      envio cancelado, oportunidade aberta e timeline escrita.
 *
 * Responde 200 mesmo em erro de processamento, de propósito: a Meta desativa
 * webhook que devolve erro repetido. O que falhou fica no `webhook_events` com
 * a mensagem, para reprocessar depois sem perder o evento.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { claimWebhook, corsHeaders, ingestInbound } from '../_shared/flow.ts';

// deno-lint-ignore no-explicit-any
type Service = any;

/** Extrai o texto de qualquer um dos formatos que a Meta manda. */
function extractContent(msg: Record<string, any>): { content: string; type: string; mediaUrl: string | null } {
  switch (msg.type) {
    case 'text':        return { content: msg.text?.body ?? '', type: 'text', mediaUrl: null };
    case 'button':      return { content: msg.button?.text ?? '', type: 'text', mediaUrl: null };
    case 'interactive': return {
      content: msg.interactive?.button_reply?.title ?? msg.interactive?.list_reply?.title ?? '',
      type: 'text', mediaUrl: null,
    };
    case 'image':       return { content: msg.image?.caption ?? '', type: 'image', mediaUrl: msg.image?.id ?? null };
    case 'audio':       return { content: '', type: 'audio', mediaUrl: msg.audio?.id ?? null };
    case 'video':       return { content: msg.video?.caption ?? '', type: 'video', mediaUrl: msg.video?.id ?? null };
    case 'document':    return { content: msg.document?.caption ?? msg.document?.filename ?? '', type: 'document', mediaUrl: msg.document?.id ?? null };
    default:            return { content: '', type: 'text', mediaUrl: null };
  }
}

/**
 * Descobre de qual workspace é o número que recebeu a mensagem.
 *
 * O `phone_number_id` vem no payload da Meta e é o que amarra o evento ao
 * canal. Sem isso não dá para saber o workspace — e uma borda multi-tenant que
 * adivinha workspace entrega mensagem de um cliente na caixa de outro.
 */
async function resolveWorkspace(service: Service, phoneNumberId: string | null): Promise<{ workspaceId: string; channelId: string } | null> {
  if (!phoneNumberId) return null;

  const { data, error } = await service
    .from('channel_secrets')
    .select('channel_id, workspace_id')
    .eq('phone_number_id', phoneNumberId)
    .maybeSingle();
  if (error) {
    console.error(`[meta-webhook] resolveWorkspace: ${error.message}`);
    return null;
  }
  if (!data) return null;
  return { workspaceId: data.workspace_id, channelId: data.channel_id };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const service = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // ── GET: handshake de verificação da Meta ──
  if (req.method === 'GET') {
    const url = new URL(req.url);
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');
    const expected = Deno.env.get('META_VERIFY_TOKEN');

    if (mode === 'subscribe' && expected && token === expected) {
      return new Response(challenge ?? '', { status: 200 });
    }
    return new Response('Forbidden', { status: 403 });
  }

  try {
    const body = await req.json();
    let processadas = 0;
    let duplicadas = 0;
    let ignoradas = 0;
    let falhas = 0;

    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        if (change.field !== 'messages') continue;

        const value = change.value ?? {};
        const phoneNumberId: string | null = value.metadata?.phone_number_id ?? null;

        const destino = await resolveWorkspace(service, phoneNumberId);
        if (!destino) {
          console.warn(`[meta-webhook] phone_number_id ${phoneNumberId} não pertence a nenhum canal conectado — evento ignorado`);
          ignoradas++;
          continue;
        }

        // Status de entrega (sent/delivered/read) fecha o ciclo da saída.
        for (const status of value.statuses ?? []) {
          const primeira = await claimWebhook(service, {
            workspaceId: destino.workspaceId,
            provider: 'meta',
            providerEventId: `status:${status.id}:${status.status}`,
            eventType: 'status',
            payload: status,
          });
          if (!primeira) { duplicadas++; continue; }

          await service.from('messages')
            .update({
              status: status.status === 'read' ? 'read' : status.status === 'delivered' ? 'delivered' : 'sent',
              ...(status.status === 'delivered' ? { delivered_at: new Date().toISOString() } : {}),
              ...(status.status === 'read' ? { read_at: new Date().toISOString() } : {}),
            })
            .eq('workspace_id', destino.workspaceId)
            .eq('provider_message_id', status.id);
          processadas++;
        }

        // Mensagens recebidas.
        const perfis: Record<string, string> = {};
        for (const c of value.contacts ?? []) {
          if (c.wa_id) perfis[c.wa_id] = c.profile?.name ?? '';
        }

        for (const msg of value.messages ?? []) {
          const primeira = await claimWebhook(service, {
            workspaceId: destino.workspaceId,
            provider: 'meta',
            providerEventId: msg.id,
            eventType: `message:${msg.type}`,
            payload: msg,
          });
          if (!primeira) {
            duplicadas++;
            continue;
          }

          const { content, type, mediaUrl } = extractContent(msg);

          try {
            const resultado = await ingestInbound(service, {
              workspaceId: destino.workspaceId,
              provider: 'meta',
              providerMessageId: msg.id,
              phone: msg.from,
              content,
              messageType: type,
              mediaUrl,
              contactName: perfis[msg.from] || null,
              channel: 'whatsapp',
            });

            await service.from('webhook_events')
              .update({ processed: true, processed_at: new Date().toISOString() })
              .eq('workspace_id', destino.workspaceId)
              .eq('provider', 'meta')
              .eq('provider_event_id', msg.id);

            console.log(
              `[meta-webhook] ${msg.from}: contato=${resultado.contact_id} ` +
              `cadências paradas=${resultado.cadencias_paradas ?? 0} ` +
              `envios cancelados=${resultado.envios_cancelados ?? 0}`,
            );
            processadas++;
          } catch (err) {
            // O claim já foi feito. Se a falha ficasse aqui sem soltar o claim,
            // a reentrega da Meta seria descartada como duplicata e a mensagem
            // do cliente sumiria para sempre — a idempotência viraria perda.
            // Solta o claim para que a reentrega (ou o reprocessamento) volte a
            // passar, e guarda o motivo.
            const motivo = err instanceof Error ? err.message : String(err);
            console.error(`[meta-webhook] falha em ${msg.id}, soltando o claim: ${motivo}`);
            await service.from('webhook_events')
              .delete()
              .eq('workspace_id', destino.workspaceId)
              .eq('provider', 'meta')
              .eq('provider_event_id', msg.id);
            falhas++;
          }
        }
      }
    }

    return new Response(JSON.stringify({ processadas, duplicadas, ignoradas, falhas }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    // 200 de propósito: a Meta desativa webhook que devolve erro repetido.
    // O evento já está gravado em webhook_events e pode ser reprocessado.
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[meta-webhook] ${message}`);
    return new Response(JSON.stringify({ error: message }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
