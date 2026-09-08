-- ============================================================================
-- Confluência · Fase 4 · Bloco 7 — A porta única aceita o operador humano
-- ----------------------------------------------------------------------------
-- Achado do typecheck do front: `api.ts` escrevia direto em `send_queue` para
-- mandar mensagem do inbox (`from_type: 'human'`), sem `workspace_id` e sem
-- `dedupe_key`. Dois clicks no botão de enviar = duas mensagens para o cliente.
--
-- `flow_enqueue_send()` fixava `from_type = 'nina'`, então o inbox não tinha
-- como usar a porta única — e por isso a contornava. Corrigir o front sem
-- corrigir a porta só empurraria o problema.
--
-- Agora a porta aceita quem está falando. Nenhum caminho precisa mais escrever
-- na fila por fora.
-- ============================================================================

create or replace function public.flow_enqueue_send(
  p_workspace_id uuid,
  p_contact_id   uuid,
  p_content      text,
  p_origin       text,
  p_dedupe_key   text,
  p_origin_id    uuid    default null,
  p_message_type text    default 'text',
  p_media_url    text    default null,
  p_scheduled_at timestamptz default now(),
  p_channel_id   uuid    default null,
  p_from_type    text    default 'nina',
  p_conversation_id uuid default null,
  p_message_id   uuid    default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id   uuid;
  v_conv uuid;
  v_bloq boolean;
begin
  if p_origin not in ('campaign','followup','flow','inbox','agent') then
    raise exception 'flow_enqueue_send: origin inválida %', p_origin;
  end if;
  if p_from_type not in ('nina','human') then
    raise exception 'flow_enqueue_send: from_type inválido %', p_from_type;
  end if;
  if coalesce(trim(p_dedupe_key),'') = '' then
    raise exception 'flow_enqueue_send: dedupe_key é obrigatória — envio sem chave não é idempotente';
  end if;

  select is_blocked into v_bloq from public.contacts
   where id = p_contact_id and workspace_id = p_workspace_id;
  if v_bloq is null then
    raise exception 'flow_enqueue_send: contato % não pertence ao workspace', p_contact_id;
  end if;

  -- Contato bloqueado não recebe automação. Mas o operador humano que abre a
  -- conversa e escreve à mão está deliberadamente falando com essa pessoa:
  -- o bloqueio serve para parar robô, não para amordaçar quem atende.
  if v_bloq and p_from_type <> 'human' then
    return null;
  end if;

  v_conv := coalesce(p_conversation_id,
                     public.flow_ensure_conversation(p_workspace_id, p_contact_id, 'whatsapp'));

  insert into public.send_queue (
    workspace_id, conversation_id, contact_id, message_type, from_type,
    content, media_url, status, priority, scheduled_at,
    dedupe_key, origin, origin_id, channel_id, message_id)
  values (
    p_workspace_id, v_conv, p_contact_id, p_message_type, p_from_type,
    p_content, p_media_url, 'pending'::queue_status,
    case p_origin when 'inbox' then 1 when 'agent' then 2 else 5 end,
    coalesce(p_scheduled_at, now()),
    p_dedupe_key, p_origin, p_origin_id, p_channel_id, p_message_id)
  on conflict (workspace_id, dedupe_key) where dedupe_key is not null
  do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id from public.send_queue
     where workspace_id = p_workspace_id and dedupe_key = p_dedupe_key;
  end if;

  return v_id;
end $$;

revoke all on function public.flow_enqueue_send(uuid,uuid,text,text,text,uuid,text,text,timestamptz,uuid,text,uuid,uuid) from public, anon;
grant execute on function public.flow_enqueue_send(uuid,uuid,text,text,text,uuid,text,text,timestamptz,uuid,text,uuid,uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Envio manual do inbox: mensagem + fila numa transação só, idempotente.
-- Substitui os dois INSERTs soltos que o front fazia em sequência — se o
-- segundo falhasse, ficava mensagem registrada que nunca seria enviada.
-- ---------------------------------------------------------------------------
create or replace function public.inbox_send_message(
  p_conversation_id uuid,
  p_content         text,
  p_dedupe_key      text,
  p_media_url       text default null,
  p_message_type    text default 'text'
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ws uuid; v_contact uuid; v_msg uuid; v_queue uuid;
begin
  if coalesce(trim(p_dedupe_key),'') = '' then
    raise exception 'inbox_send_message: dedupe_key é obrigatória';
  end if;

  select workspace_id, contact_id into v_ws, v_contact
    from public.conversations where id = p_conversation_id;
  if v_ws is null then
    raise exception 'inbox_send_message: conversa % não existe', p_conversation_id;
  end if;
  if not public.is_workspace_member(v_ws, auth.uid()) then
    raise exception 'inbox_send_message: sem acesso a esta conversa';
  end if;

  -- reenvio da mesma chave devolve o que já existe, não duplica
  select sq.id, sq.message_id into v_queue, v_msg
    from public.send_queue sq
   where sq.workspace_id = v_ws and sq.dedupe_key = p_dedupe_key;
  if v_queue is not null then
    return jsonb_build_object('duplicada', true, 'message_id', v_msg, 'queue_id', v_queue);
  end if;

  insert into public.messages (
    workspace_id, conversation_id, type, from_type, content, media_url, status, sent_at)
  values (
    v_ws, p_conversation_id, p_message_type::message_type, 'human'::message_from,
    p_content, p_media_url, 'processing'::message_status, now())
  returning id into v_msg;

  v_queue := public.flow_enqueue_send(
    v_ws, v_contact, p_content, 'inbox', p_dedupe_key,
    null, p_message_type, p_media_url, now(), null, 'human', p_conversation_id, v_msg);

  update public.conversations
     set last_message_at = now(), updated_at = now()
   where id = p_conversation_id;

  return jsonb_build_object('duplicada', false, 'message_id', v_msg, 'queue_id', v_queue);
end $$;

revoke all on function public.inbox_send_message(uuid,text,text,text,text) from public, anon;
grant execute on function public.inbox_send_message(uuid,text,text,text,text) to authenticated, service_role;
