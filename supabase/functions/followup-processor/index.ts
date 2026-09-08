/**
 * followup-processor — avança as cadências vencidas.
 *
 * Portado do doador A (824 linhas → ~200). O que encolheu não foi
 * funcionalidade, foi trabalho que o banco passou a fazer melhor:
 *
 *   • A checagem "o lead respondeu?" saiu daqui. Ela varria
 *     `conversation_messages` a cada passo, o que significava que entre a
 *     resposta do lead e a próxima varredura o follow-up ainda podia disparar.
 *     Agora `flow_ingest_inbound()` para a cadência no mesmo instante em que a
 *     mensagem entra — não há janela.
 *   • O envio saiu daqui. Enfileira em `send_queue` pela porta única e o
 *     `send-worker` entrega. Antes esta função falava com o provedor direto e
 *     tinha o próprio tratamento de retry.
 *   • Os estados viraram quatro (`active`, `paused`, `completed`, `stopped`)
 *     mais um `stop_reason` legível. O original tinha oito, entre eles
 *     `paused_by_reply`, `expired`, `converted` e `skipped` — que são motivo,
 *     não estado, e por isso não cabiam em relatório nenhum.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { authenticateCronRequest } from '../_shared/cron-auth.ts';
import { corsHeaders, enqueueSend, json, recordEvent } from '../_shared/flow.ts';

// deno-lint-ignore no-explicit-any
type Service = any;

const BATCH_SIZE = 50;

interface Sequence {
  id: string;
  workspace_id: string;
  status: string;
  send_window: Record<string, unknown>;
  timezone: string;
  min_interval_hours: number;
  max_attempts: number;
  ttl_days: number | null;
}

interface Enrollment {
  id: string;
  workspace_id: string;
  sequence_id: string;
  contact_id: string;
  current_step: number;
  enrolled_at: string;
  variables: Record<string, string>;
}

/**
 * Janela de envio: `{ dias: [1..5], inicio: "09:00", fim: "18:00" }`.
 * Fora da janela o passo não é perdido — é reagendado para a próxima abertura.
 * Mandar cobrança de vendas às 3 da manhã queima o número e o lead.
 */
function proximaAbertura(window: Record<string, unknown>, timezone: string): Date | null {
  const dias = (window.dias as number[] | undefined) ?? [1, 2, 3, 4, 5];
  const inicio = (window.inicio as string | undefined) ?? '09:00';
  const fim = (window.fim as string | undefined) ?? '18:00';
  if (!dias.length) return null;

  const agora = new Date();
  const local = new Date(agora.toLocaleString('en-US', { timeZone: timezone || 'America/Sao_Paulo' }));
  const [hi, mi] = inicio.split(':').map(Number);
  const [hf, mf] = fim.split(':').map(Number);
  const minutosAgora = local.getHours() * 60 + local.getMinutes();
  const abre = hi * 60 + mi;
  const fecha = hf * 60 + mf;

  if (dias.includes(local.getDay()) && minutosAgora >= abre && minutosAgora < fecha) {
    return null; // já está dentro da janela
  }

  // procura a próxima abertura em até uma semana
  for (let salto = 0; salto <= 7; salto++) {
    const alvo = new Date(local);
    alvo.setDate(alvo.getDate() + salto);
    if (!dias.includes(alvo.getDay())) continue;
    if (salto === 0 && minutosAgora >= abre) continue;
    alvo.setHours(hi, mi, 0, 0);
    const deslocamento = agora.getTime() - local.getTime();
    return new Date(alvo.getTime() + deslocamento);
  }
  return null;
}

function aplicarVariaveis(texto: string, vars: Record<string, string>): string {
  return texto.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, chave) => vars[chave] ?? '');
}

function proximoEnvio(passo: { delay_value: number; delay_unit: string }, minIntervalHours: number): string {
  const unidade = passo.delay_unit === 'hours' ? 3_600_000 : passo.delay_unit === 'minutes' ? 60_000 : 86_400_000;
  const espera = Math.max(passo.delay_value * unidade, minIntervalHours * 3_600_000);
  return new Date(Date.now() + espera).toISOString();
}

async function encerrar(
  service: Service,
  inscricao: Pick<Enrollment, 'id' | 'workspace_id' | 'current_step'>,
  status: 'completed' | 'stopped',
  motivo: string,
) {
  await service.from('followup_enrollments')
    .update({ status, stop_reason: motivo, completed_at: new Date().toISOString(), next_send_at: null })
    .eq('id', inscricao.id);
  await service.from('followup_logs').insert({
    workspace_id: inscricao.workspace_id,
    enrollment_id: inscricao.id,
    step_position: inscricao.current_step,
    action: 'stopped',
    reason: motivo,
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const naoAutorizado = authenticateCronRequest(req);
  if (naoAutorizado) return naoAutorizado;

  const service = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    const agora = new Date().toISOString();

    const { data: pendentes, error } = await service
      .from('followup_enrollments')
      .select('id, workspace_id, sequence_id, contact_id, current_step, enrolled_at, variables')
      .eq('status', 'active')
      .lte('next_send_at', agora)
      .order('next_send_at', { ascending: true })
      .limit(BATCH_SIZE);
    if (error) throw new Error(`enrollments: ${error.message}`);

    const fila = (pendentes ?? []) as Enrollment[];
    if (fila.length === 0) return json({ processadas: 0, enfileiradas: 0, encerradas: 0, adiadas: 0 });

    let enfileiradas = 0;
    let encerradas = 0;
    let adiadas = 0;

    for (const inscricao of fila) {
      try {
        const { data: seq } = await service
          .from('followup_sequences')
          .select('id, workspace_id, status, send_window, timezone, min_interval_hours, max_attempts, ttl_days')
          .eq('id', inscricao.sequence_id)
          .single();
        const sequencia = seq as Sequence | null;

        if (!sequencia || sequencia.status !== 'active') {
          await service.from('followup_enrollments')
            .update({ status: 'paused', stop_reason: 'sequencia_inativa', next_send_at: null })
            .eq('id', inscricao.id);
          adiadas++;
          continue;
        }

        // TTL: cadência que não converteu em N dias para de insistir.
        if (sequencia.ttl_days) {
          const limite = new Date(inscricao.enrolled_at).getTime() + sequencia.ttl_days * 86_400_000;
          if (Date.now() > limite) {
            await encerrar(service, inscricao, 'stopped', 'ttl_expirado');
            encerradas++;
            continue;
          }
        }

        // Teto de tentativas, contado pelos envios que realmente saíram.
        const { count: enviados } = await service
          .from('followup_logs')
          .select('id', { count: 'exact', head: true })
          .eq('enrollment_id', inscricao.id)
          .eq('action', 'sent');
        if ((enviados ?? 0) >= (sequencia.max_attempts ?? 999)) {
          await encerrar(service, inscricao, 'completed', 'max_tentativas');
          encerradas++;
          continue;
        }

        // Janela de envio.
        const reagendar = proximaAbertura(sequencia.send_window ?? {}, sequencia.timezone);
        if (reagendar) {
          await service.from('followup_enrollments')
            .update({ next_send_at: reagendar.toISOString() })
            .eq('id', inscricao.id);
          adiadas++;
          continue;
        }

        const { data: passo } = await service
          .from('followup_steps')
          .select('id, position, content, content_type, media_urls, delay_value, delay_unit')
          .eq('sequence_id', sequencia.id)
          .eq('position', inscricao.current_step + 1)
          .maybeSingle();

        if (!passo) {
          await encerrar(service, inscricao, 'completed', 'sequencia_concluida');
          encerradas++;
          continue;
        }

        const { data: contato } = await service
          .from('contacts')
          .select('name, phone_e164')
          .eq('id', inscricao.contact_id)
          .single();

        const conteudo = aplicarVariaveis(passo.content ?? '', {
          nome: contato?.name ?? '',
          primeiro_nome: (contato?.name ?? '').split(' ')[0] ?? '',
          ...(inscricao.variables ?? {}),
        });

        // Porta única. A chave amarra inscrição + passo: reprocessar o mesmo
        // passo (retry do cron, execução concorrente) não manda de novo.
        const filaId = await enqueueSend(service, {
          workspaceId: inscricao.workspace_id,
          contactId: inscricao.contact_id,
          content: conteudo,
          origin: 'followup',
          dedupeKey: `followup:${inscricao.id}:${passo.position}`,
          originId: inscricao.id,
          messageType: passo.content_type === 'text' ? 'text' : passo.content_type,
          mediaUrl: passo.media_urls?.[0] ?? null,
        });

        // null = contato bloqueado entre a inscrição e agora. Não é erro.
        if (filaId === null) {
          await encerrar(service, inscricao, 'stopped', 'contato_bloqueado');
          encerradas++;
          continue;
        }

        await service.from('followup_logs').insert({
          workspace_id: inscricao.workspace_id,
          enrollment_id: inscricao.id,
          step_position: passo.position,
          action: 'sent',
          reason: `Passo ${passo.position} enfileirado`,
        });

        await service.from('followup_enrollments').update({
          current_step: passo.position,
          next_send_at: proximoEnvio(passo, sequencia.min_interval_hours ?? 24),
        }).eq('id', inscricao.id);

        await recordEvent(service, {
          workspaceId: inscricao.workspace_id,
          contactId: inscricao.contact_id,
          stage: 'cadencia',
          eventType: 'cadencia_passo_enviado',
          title: `Follow-up ${passo.position} enviado`,
          detail: { sequence_id: sequencia.id, step: passo.position },
          dedupeKey: `cadencia_passo:${inscricao.id}:${passo.position}`,
        });

        enfileiradas++;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[followup-processor] inscrição ${inscricao.id}: ${message}`);
        await service.from('followup_logs').insert({
          workspace_id: inscricao.workspace_id,
          enrollment_id: inscricao.id,
          step_position: inscricao.current_step,
          action: 'error',
          reason: message.slice(0, 300),
        });
      }
    }

    return json({ processadas: fila.length, enfileiradas, encerradas, adiadas });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[followup-processor] ${message}`);
    return json({ error: message }, 500);
  }
});
