/**
 * Contrato das edge functions com a espinha do fluxo.
 *
 * Nenhuma função portada escreve direto em `contacts`, `deals`, `messages`,
 * `send_queue`, `followup_enrollments` ou `journey_events`. Toda escrita que
 * atravessa etapas passa por uma destas chamadas, que são as mesmas portas que
 * o front usa. É o que garante que idempotência e concatenação valham para
 * qualquer caminho — front, worker, webhook ou cron.
 *
 * Se você precisar de uma escrita que não está aqui, o lugar de resolver é uma
 * RPC nova no banco, não um INSERT solto nesta camada.
 */

// deno-lint-ignore no-explicit-any
type Service = any;

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function rpc<T>(service: Service, name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await service.rpc(name, args);
  if (error) throw new Error(`${name}: ${error.message}`);
  return data as T;
}

// ── Etapa 1 · empresa ───────────────────────────────────────────────────────

export function upsertCompany(service: Service, params: {
  workspaceId: string;
  name: string;
  domain?: string | null;
  cnpj?: string | null;
  data?: Record<string, unknown>;
  searchId?: string | null;
}): Promise<string> {
  return rpc(service, 'flow_upsert_company', {
    p_workspace_id: params.workspaceId,
    p_name: params.name,
    p_domain: params.domain ?? null,
    p_cnpj: params.cnpj ?? null,
    p_data: params.data ?? {},
    p_search_id: params.searchId ?? null,
  });
}

// ── Etapa 2 · decisor ───────────────────────────────────────────────────────

export function upsertContact(service: Service, params: {
  workspaceId: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  companyId?: string | null;
  roleTitle?: string | null;
  isDecisionMaker?: boolean;
  source?: string | null;
  data?: Record<string, unknown>;
}): Promise<string> {
  return rpc(service, 'flow_upsert_contact', {
    p_workspace_id: params.workspaceId,
    p_name: params.name,
    p_phone: params.phone ?? null,
    p_email: params.email ?? null,
    p_company_id: params.companyId ?? null,
    p_role_title: params.roleTitle ?? null,
    p_is_decision_maker: params.isDecisionMaker ?? false,
    p_source: params.source ?? null,
    p_data: params.data ?? {},
  });
}

export function applyEnrichment(service: Service, contactId: string, score: number | null, data: Record<string, unknown> = {}) {
  return rpc<void>(service, 'lead_enrich_apply', {
    p_contact_id: contactId,
    p_score: score,
    p_data: data,
  });
}

// ── Etapa 3 · cadência ──────────────────────────────────────────────────────

/** Devolve null quando o contato está bloqueado — não é erro, é a regra. */
export function enrollFollowup(service: Service, sequenceId: string, contactId: string, variables: Record<string, unknown> = {}): Promise<string | null> {
  return rpc(service, 'flow_enroll_followup', {
    p_sequence_id: sequenceId,
    p_contact_id: contactId,
    p_variables: variables,
  });
}

// ── Porta única de envio ────────────────────────────────────────────────────

export type SendOrigin = 'campaign' | 'followup' | 'flow' | 'inbox' | 'agent';

/**
 * `dedupeKey` não tem default de propósito: quem enfileira precisa declarar o
 * que torna aquele envio único. Sem isso o retry do worker vira mensagem
 * repetida para o cliente.
 */
export function enqueueSend(service: Service, params: {
  workspaceId: string;
  contactId: string;
  content: string;
  origin: SendOrigin;
  dedupeKey: string;
  originId?: string | null;
  messageType?: string;
  mediaUrl?: string | null;
  scheduledAt?: string | null;
  channelId?: string | null;
  fromType?: 'nina' | 'human';
  conversationId?: string | null;
}): Promise<string | null> {
  return rpc(service, 'flow_enqueue_send', {
    p_workspace_id: params.workspaceId,
    p_contact_id: params.contactId,
    p_content: params.content,
    p_origin: params.origin,
    p_dedupe_key: params.dedupeKey,
    p_origin_id: params.originId ?? null,
    p_message_type: params.messageType ?? 'text',
    p_media_url: params.mediaUrl ?? null,
    p_scheduled_at: params.scheduledAt ?? new Date().toISOString(),
    p_channel_id: params.channelId ?? null,
    p_from_type: params.fromType ?? 'nina',
    p_conversation_id: params.conversationId ?? null,
  });
}

// ── Borda de entrada ────────────────────────────────────────────────────────

/** true = primeira vez que este evento chega; false = já foi processado. */
export function claimWebhook(service: Service, params: {
  workspaceId: string;
  provider: string;
  providerEventId: string;
  eventType?: string | null;
  payload?: unknown;
}): Promise<boolean> {
  return rpc(service, 'webhook_claim', {
    p_workspace_id: params.workspaceId,
    p_provider: params.provider,
    p_provider_event_id: params.providerEventId,
    p_event_type: params.eventType ?? null,
    p_payload: params.payload ?? {},
  });
}

export interface InboundResult {
  duplicada: boolean;
  message_id: string;
  conversation_id: string;
  contact_id: string;
  deal_id?: string;
  cadencias_paradas?: number;
  envios_cancelados?: number;
}

/**
 * O nó da concatenação. Uma chamada deduplica, garante conversa, grava a
 * mensagem, para a cadência, cancela o envio pendente, abre a oportunidade e
 * escreve a timeline — tudo no mesmo bloco transacional.
 */
export function ingestInbound(service: Service, params: {
  workspaceId: string;
  provider: string;
  providerMessageId: string;
  phone: string;
  content: string;
  messageType?: string;
  mediaUrl?: string | null;
  contactName?: string | null;
  channel?: string;
}): Promise<InboundResult> {
  return rpc(service, 'flow_ingest_inbound', {
    p_workspace_id: params.workspaceId,
    p_provider: params.provider,
    p_provider_message_id: params.providerMessageId,
    p_phone: params.phone,
    p_content: params.content,
    p_message_type: params.messageType ?? 'text',
    p_media_url: params.mediaUrl ?? null,
    p_contact_name: params.contactName ?? null,
    p_channel: params.channel ?? 'whatsapp',
  });
}

// ── CRM ─────────────────────────────────────────────────────────────────────

export function ensureDeal(service: Service, workspaceId: string, contactId: string, source?: string | null): Promise<string> {
  return rpc(service, 'crm_ensure_deal', {
    p_workspace_id: workspaceId,
    p_contact_id: contactId,
    p_source: source ?? null,
  });
}

export function recordEvent(service: Service, params: {
  workspaceId: string;
  contactId: string;
  stage: 'prospeccao' | 'enriquecimento' | 'cadencia' | 'conversa' | 'crm' | 'fechamento';
  eventType: string;
  title: string;
  detail?: Record<string, unknown>;
  dedupeKey?: string | null;
  companyId?: string | null;
  dealId?: string | null;
  conversationId?: string | null;
}): Promise<string> {
  return rpc(service, 'flow_record_event', {
    p_workspace_id: params.workspaceId,
    p_contact_id: params.contactId,
    p_stage: params.stage,
    p_event_type: params.eventType,
    p_title: params.title,
    p_detail: params.detail ?? {},
    p_dedupe_key: params.dedupeKey ?? null,
    p_company_id: params.companyId ?? null,
    p_deal_id: params.dealId ?? null,
    p_conversation_id: params.conversationId ?? null,
  });
}
