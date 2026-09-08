/**
 * O motor único de entrega.
 *
 * Os três sistemas fundidos falavam com WhatsApp por três caminhos diferentes:
 * Evolution (não oficial, doador A), Meta Cloud API (oficial, doador B) e
 * Zernio (trunk). Cada um tinha sua própria função de envio, seu próprio
 * formato de erro e seu próprio jeito de registrar o que saiu.
 *
 * Aqui eles viram adapters do MESMO motor. Quem envia não escolhe provedor:
 * enfileira em `send_queue` e o worker resolve o canal. Trocar de provedor
 * passa a ser mudar uma linha em `channel_connections`, não reescrever o fluxo.
 */

// deno-lint-ignore no-explicit-any
type Service = any;

const GRAPH_API_VERSION = 'v22.0';

export type Provider = 'meta' | 'evolution' | 'zernio';

export interface ResolvedChannel {
  id: string;
  provider: Provider;
  externalAccountId: string | null;
  /** Meta */
  phoneNumberId?: string | null;
  wabaId?: string | null;
  accessToken?: string | null;
  /** Evolution */
  baseUrl?: string | null;
  instanceName?: string | null;
  apiKey?: string | null;
}

export interface OutboundMessage {
  phone: string;
  content: string | null;
  messageType: string;
  mediaUrl?: string | null;
  fileName?: string | null;
  templateName?: string | null;
  templateLanguage?: string | null;
  templateVariables?: Record<string, string[]> | null;
}

export interface DeliveryResult {
  providerMessageId: string | null;
  raw: unknown;
}

/**
 * Resolve o canal de saída do workspace. `channelId` explícito ganha; senão o
 * canal marcado como padrão; senão o único ativo.
 *
 * Falha com mensagem clara em vez de cair num fallback silencioso: mandar por
 * uma conta diferente da que o operador configurou é pior do que não mandar.
 */
export async function resolveChannel(
  service: Service,
  workspaceId: string,
  channelId?: string | null,
): Promise<ResolvedChannel> {
  let query = service
    .from('channel_connections')
    .select('id, provider, external_account_id, is_default, status')
    .eq('workspace_id', workspaceId)
    .eq('status', 'connected');

  if (channelId) query = query.eq('id', channelId);
  else query = query.order('is_default', { ascending: false });

  const { data: rows, error } = await query.limit(1);
  if (error) throw new Error(`resolveChannel: ${error.message}`);
  const row = rows?.[0];
  if (!row) {
    throw new Error(
      channelId
        ? `Canal ${channelId} não está conectado neste workspace.`
        : 'Nenhum canal conectado neste workspace. Conecte um número antes de enviar.',
    );
  }

  const { data: secret, error: secretError } = await service
    .from('channel_secrets')
    .select('waba_id, phone_number_id, access_token, extra')
    .eq('channel_id', row.id)
    .maybeSingle();
  if (secretError) throw new Error(`resolveChannel: ${secretError.message}`);

  const extra = (secret?.extra ?? {}) as Record<string, string | null>;

  return {
    id: row.id,
    provider: row.provider as Provider,
    externalAccountId: row.external_account_id,
    phoneNumberId: secret?.phone_number_id ?? null,
    wabaId: secret?.waba_id ?? null,
    accessToken: secret?.access_token ?? null,
    baseUrl: extra.base_url ?? null,
    instanceName: extra.instance_name ?? row.external_account_id,
    apiKey: extra.api_key ?? null,
  };
}

// ── Adapter: Meta Cloud API (oficial) ───────────────────────────────────────

function metaPayload(msg: OutboundMessage) {
  const to = msg.phone.replace(/\D/g, '');

  if (msg.messageType === 'template' && msg.templateName) {
    const components: unknown[] = [];
    const vars = msg.templateVariables ?? {};
    if (vars.header?.length) {
      components.push({ type: 'header', parameters: vars.header.map((v) => ({ type: 'text', text: v })) });
    }
    if (vars.body?.length) {
      components.push({ type: 'body', parameters: vars.body.map((v) => ({ type: 'text', text: v })) });
    }
    return {
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: msg.templateName,
        language: { code: msg.templateLanguage || 'pt_BR' },
        ...(components.length ? { components } : {}),
      },
    };
  }

  if (msg.mediaUrl && msg.messageType === 'image') {
    return { messaging_product: 'whatsapp', to, type: 'image', image: { link: msg.mediaUrl, caption: msg.content ?? '' } };
  }
  if (msg.mediaUrl && msg.messageType === 'document') {
    return {
      messaging_product: 'whatsapp', to, type: 'document',
      document: { link: msg.mediaUrl, caption: msg.content ?? '', filename: msg.fileName || 'documento' },
    };
  }
  if (msg.mediaUrl && msg.messageType === 'audio') {
    return { messaging_product: 'whatsapp', to, type: 'audio', audio: { link: msg.mediaUrl } };
  }

  return { messaging_product: 'whatsapp', to, type: 'text', text: { body: msg.content ?? '' } };
}

async function sendViaMeta(channel: ResolvedChannel, msg: OutboundMessage): Promise<DeliveryResult> {
  if (!channel.phoneNumberId || !channel.accessToken) {
    throw new Error('Canal Meta sem phone_number_id ou access_token configurado.');
  }

  const response = await fetch(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/${channel.phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${channel.accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(metaPayload(msg)),
    },
  );

  const result = await response.json();
  if (!response.ok) {
    throw new Error(`Meta API ${response.status}: ${result?.error?.message ?? 'erro desconhecido'}`);
  }
  return { providerMessageId: result?.messages?.[0]?.id ?? null, raw: result };
}

// ── Adapter: Evolution (não oficial) ────────────────────────────────────────

async function sendViaEvolution(channel: ResolvedChannel, msg: OutboundMessage): Promise<DeliveryResult> {
  if (!channel.baseUrl || !channel.apiKey || !channel.instanceName) {
    throw new Error('Canal Evolution sem base_url, api_key ou instance_name configurado.');
  }

  const number = msg.phone.replace(/\D/g, '');
  const isMedia = Boolean(msg.mediaUrl) && msg.messageType !== 'text';
  const path = isMedia ? 'sendMedia' : 'sendText';
  const body = isMedia
    ? { number, mediatype: msg.messageType, media: msg.mediaUrl, caption: msg.content ?? '', fileName: msg.fileName ?? undefined }
    : { number, text: msg.content ?? '' };

  const response = await fetch(`${channel.baseUrl.replace(/\/$/, '')}/message/${path}/${channel.instanceName}`, {
    method: 'POST',
    headers: { apikey: channel.apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const result = await response.json();
  if (!response.ok) {
    throw new Error(`Evolution ${response.status}: ${result?.message ?? JSON.stringify(result).slice(0, 200)}`);
  }
  return { providerMessageId: result?.key?.id ?? null, raw: result };
}

// ── Adapter: Zernio (trunk) ─────────────────────────────────────────────────

async function sendViaZernio(channel: ResolvedChannel, msg: OutboundMessage): Promise<DeliveryResult> {
  const token = Deno.env.get('ZERNIO_API_KEY');
  if (!token) throw new Error('ZERNIO_API_KEY ausente no ambiente.');
  if (!channel.externalAccountId) throw new Error('Canal Zernio sem external_account_id.');

  const response = await fetch('https://api.zernio.com/v1/messages', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      account_id: channel.externalAccountId,
      to: msg.phone,
      text: msg.content ?? '',
      media_url: msg.mediaUrl ?? undefined,
    }),
  });

  const result = await response.json();
  if (!response.ok) {
    throw new Error(`Zernio ${response.status}: ${result?.message ?? 'erro desconhecido'}`);
  }
  return { providerMessageId: result?.id ?? null, raw: result };
}

/** Ponto único de saída. Quem chama não sabe — nem precisa saber — qual provedor entrega. */
export function deliver(channel: ResolvedChannel, msg: OutboundMessage): Promise<DeliveryResult> {
  switch (channel.provider) {
    case 'meta': return sendViaMeta(channel, msg);
    case 'evolution': return sendViaEvolution(channel, msg);
    case 'zernio': return sendViaZernio(channel, msg);
    default: throw new Error(`Provedor desconhecido: ${channel.provider}`);
  }
}
