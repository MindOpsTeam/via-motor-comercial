-- ============================================================================
-- Confluência · Fase 4 · Bloco 3/4 — Regra de negócio: a porta única do fluxo
-- ----------------------------------------------------------------------------
-- Toda escrita que atravessa etapas passa por uma destas funções. Elas são a
-- forma de impor três coisas que disciplina de time não impõe:
--
--   1. IDEMPOTÊNCIA — chamar duas vezes com o mesmo insumo não duplica nada.
--   2. CONCATENAÇÃO  — cada etapa entrega para a próxima no mesmo bloco
--                      transacional, sem depender de um segundo processo.
--   3. AUTORIDADE    — um dono por coluna, imposto aqui e não no front.
--
-- Nenhuma tela escreve direto nas tabelas de fluxo. O front chama a RPC.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0. Timeline — helper usado por todas as etapas
-- ---------------------------------------------------------------------------
create or replace function public.flow_record_event(
  p_workspace_id uuid,
  p_contact_id   uuid,
  p_stage        text,
  p_event_type   text,
  p_title        text,
  p_detail       jsonb default '{}'::jsonb,
  p_dedupe_key   text default null,
  p_company_id   uuid default null,
  p_deal_id      uuid default null,
  p_conversation_id uuid default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  insert into public.journey_events (
    workspace_id, contact_id, company_id, deal_id, conversation_id,
    stage, event_type, title, detail, dedupe_key)
  values (
    p_workspace_id, p_contact_id, p_company_id, p_deal_id, p_conversation_id,
    p_stage, p_event_type, p_title, coalesce(p_detail,'{}'::jsonb), p_dedupe_key)
  on conflict (workspace_id, dedupe_key) where dedupe_key is not null
  do update set detail = excluded.detail
  returning id into v_id;

  return v_id;
end $$;

-- ---------------------------------------------------------------------------
-- 1. ETAPA 1 — EMPRESA. Idempotente por domínio ou CNPJ.
-- ---------------------------------------------------------------------------
create or replace function public.flow_upsert_company(
  p_workspace_id uuid,
  p_name         text,
  p_domain       text default null,
  p_cnpj         text default null,
  p_data         jsonb default '{}'::jsonb,
  p_search_id    uuid default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  if p_workspace_id is null or coalesce(trim(p_name),'') = '' then
    raise exception 'flow_upsert_company: workspace_id e name são obrigatórios';
  end if;

  -- resolve primeiro pelas chaves naturais; só cria se não achou
  select id into v_id from public.lead_companies
   where workspace_id = p_workspace_id
     and ( (p_domain is not null and lower(domain) = lower(p_domain))
        or (p_cnpj   is not null and cnpj = p_cnpj) )
   limit 1;

  if v_id is null then
    insert into public.lead_companies (
      workspace_id, name, domain, cnpj, website, linkedin_url, instagram, facebook,
      phone, whatsapp, email, industry, description, services, employees_count,
      revenue, founding_year, address, city, ai_score, ai_summary, apollo_org_id, search_id)
    values (
      p_workspace_id, p_name, p_domain, p_cnpj,
      p_data->>'website', p_data->>'linkedin_url', p_data->>'instagram', p_data->>'facebook',
      p_data->>'phone', p_data->>'whatsapp', p_data->>'email', p_data->>'industry',
      p_data->>'description',
      case when p_data ? 'services'
           then array(select jsonb_array_elements_text(p_data->'services')) end,
      nullif(p_data->>'employees_count','')::integer,
      p_data->>'revenue',
      nullif(p_data->>'founding_year','')::integer,
      p_data->>'address', p_data->>'city',
      nullif(p_data->>'ai_score','')::numeric,
      p_data->>'ai_summary', p_data->>'apollo_org_id', p_search_id)
    returning id into v_id;
  else
    -- reexecução enriquece, nunca apaga o que já havia
    update public.lead_companies set
      name            = coalesce(nullif(p_name,''), name),
      website         = coalesce(p_data->>'website', website),
      linkedin_url    = coalesce(p_data->>'linkedin_url', linkedin_url),
      industry        = coalesce(p_data->>'industry', industry),
      description     = coalesce(p_data->>'description', description),
      employees_count = coalesce(nullif(p_data->>'employees_count','')::integer, employees_count),
      revenue         = coalesce(p_data->>'revenue', revenue),
      city            = coalesce(p_data->>'city', city),
      ai_score        = coalesce(nullif(p_data->>'ai_score','')::numeric, ai_score),
      ai_summary      = coalesce(p_data->>'ai_summary', ai_summary),
      search_id       = coalesce(p_search_id, search_id),
      updated_at      = now()
    where id = v_id;
  end if;

  return v_id;
end $$;

-- ---------------------------------------------------------------------------
-- 2. ETAPA 2 — DECISOR. Idempotente por telefone (ou e-mail). Liga na empresa
--    e abre a timeline. É aqui que a prospecção entrega para o resto do fluxo.
-- ---------------------------------------------------------------------------
create or replace function public.flow_upsert_contact(
  p_workspace_id      uuid,
  p_name              text,
  p_phone             text default null,
  p_email             text default null,
  p_company_id        uuid default null,
  p_role_title        text default null,
  p_is_decision_maker boolean default false,
  p_source            text default null,
  p_data              jsonb default '{}'::jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id      uuid;
  v_phone   text := public.normalize_phone(p_phone);
  v_novo    boolean := false;
begin
  if p_workspace_id is null then
    raise exception 'flow_upsert_contact: workspace_id é obrigatório';
  end if;
  if v_phone is null and coalesce(trim(p_email),'') = '' then
    raise exception 'flow_upsert_contact: é preciso telefone ou e-mail para identificar o contato';
  end if;

  select id into v_id from public.contacts
   where workspace_id = p_workspace_id
     and ( (v_phone is not null and phone_e164 = v_phone)
        or (p_email is not null and lower(email) = lower(p_email)) )
   limit 1;

  if v_id is null then
    insert into public.contacts (
      workspace_id, name, phone_number, email, lead_company_id, role_title,
      is_decision_maker, source, lifecycle_status, enrichment_score, notes, tags)
    values (
      p_workspace_id, coalesce(nullif(p_name,''), v_phone, p_email),
      coalesce(v_phone, p_phone), p_email, p_company_id, p_role_title,
      coalesce(p_is_decision_maker,false), p_source, 'novo',
      nullif(p_data->>'enrichment_score','')::numeric,
      p_data->>'notes',
      case when p_data ? 'tags'
           then array(select jsonb_array_elements_text(p_data->'tags')) end)
    returning id into v_id;
    v_novo := true;
  else
    update public.contacts set
      name              = coalesce(nullif(p_name,''), name),
      email             = coalesce(p_email, email),
      lead_company_id   = coalesce(p_company_id, lead_company_id),
      role_title        = coalesce(p_role_title, role_title),
      is_decision_maker = greatest(is_decision_maker::int, coalesce(p_is_decision_maker,false)::int)::boolean,
      source            = coalesce(source, p_source),
      updated_at        = now()
    where id = v_id;
  end if;

  if v_novo then
    perform public.flow_record_event(
      p_workspace_id, v_id, 'prospeccao', 'contato_criado',
      coalesce(nullif(p_name,''), v_phone, p_email) || ' entrou no fluxo',
      jsonb_build_object('source', p_source, 'role', p_role_title),
      'contato_criado:'||v_id::text, p_company_id);
  end if;

  return v_id;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Enriquecimento — autoridade exclusiva sobre enrichment_score
-- ---------------------------------------------------------------------------
create or replace function public.lead_enrich_apply(
  p_contact_id uuid,
  p_score      numeric,
  p_data       jsonb default '{}'::jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_ws uuid;
begin
  update public.contacts set
    enrichment_score = p_score,
    role_title       = coalesce(p_data->>'role_title', role_title),
    email            = coalesce(email, p_data->>'email'),
    updated_at       = now()
  where id = p_contact_id
  returning workspace_id into v_ws;

  if v_ws is null then
    raise exception 'lead_enrich_apply: contato % não existe', p_contact_id;
  end if;

  perform public.flow_record_event(
    v_ws, p_contact_id, 'enriquecimento', 'contato_enriquecido',
    'Contato enriquecido (score '||coalesce(p_score::text,'—')||')',
    p_data, 'enriquecido:'||p_contact_id::text||':'||coalesce(p_score::text,'0'));
end $$;

-- ---------------------------------------------------------------------------
-- 4. ETAPA 3/4 — CADÊNCIA. Uma inscrição viva por sequência e contato.
-- ---------------------------------------------------------------------------
create or replace function public.flow_enroll_followup(
  p_sequence_id uuid,
  p_contact_id  uuid,
  p_variables   jsonb default '{}'::jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ws  uuid;
  v_id  uuid;
  v_bloqueado boolean;
begin
  select s.workspace_id into v_ws
    from public.followup_sequences s where s.id = p_sequence_id;
  if v_ws is null then
    raise exception 'flow_enroll_followup: sequência % não existe', p_sequence_id;
  end if;

  select c.is_blocked into v_bloqueado
    from public.contacts c where c.id = p_contact_id and c.workspace_id = v_ws;
  if v_bloqueado is null then
    raise exception 'flow_enroll_followup: contato % não pertence ao workspace da sequência', p_contact_id;
  end if;
  if v_bloqueado then
    return null;  -- contato bloqueado nunca entra em cadência
  end if;

  -- a chave única parcial faz o trabalho: reinscrever devolve a inscrição viva
  insert into public.followup_enrollments (
    workspace_id, sequence_id, contact_id, status, current_step, next_send_at, variables)
  values (v_ws, p_sequence_id, p_contact_id, 'active', 0, now(), coalesce(p_variables,'{}'::jsonb))
  on conflict do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id from public.followup_enrollments
     where sequence_id = p_sequence_id and contact_id = p_contact_id
       and status in ('active','paused') limit 1;
    return v_id;
  end if;

  perform public.flow_record_event(
    v_ws, p_contact_id, 'cadencia', 'cadencia_iniciada',
    'Entrou na cadência de follow-up',
    jsonb_build_object('sequence_id', p_sequence_id),
    'cadencia_inicio:'||v_id::text);

  return v_id;
end $$;

-- ---------------------------------------------------------------------------
-- 5. PORTA ÚNICA DE ENVIO. Campanha, cadência, fluxo, inbox e agente entram
--    aqui — e só aqui. Nada fala com provedor por fora.
-- ---------------------------------------------------------------------------
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
  p_channel_id   uuid    default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id    uuid;
  v_conv  uuid;
  v_bloq  boolean;
begin
  if p_origin not in ('campaign','followup','flow','inbox','agent') then
    raise exception 'flow_enqueue_send: origin inválida %', p_origin;
  end if;
  if coalesce(trim(p_dedupe_key),'') = '' then
    raise exception 'flow_enqueue_send: dedupe_key é obrigatória — envio sem chave não é idempotente';
  end if;

  select is_blocked into v_bloq from public.contacts
   where id = p_contact_id and workspace_id = p_workspace_id;
  if v_bloq is null then
    raise exception 'flow_enqueue_send: contato % não pertence ao workspace', p_contact_id;
  end if;
  if v_bloq then
    return null;  -- bloqueado não recebe, venha de onde vier
  end if;

  v_conv := public.flow_ensure_conversation(p_workspace_id, p_contact_id, 'whatsapp');

  insert into public.send_queue (
    workspace_id, conversation_id, contact_id, message_type, from_type,
    content, media_url, status, priority, scheduled_at,
    dedupe_key, origin, origin_id, channel_id)
  values (
    p_workspace_id, v_conv, p_contact_id, p_message_type, 'nina',
    p_content, p_media_url, 'pending'::queue_status,
    case p_origin when 'inbox' then 1 when 'agent' then 2 else 5 end,
    coalesce(p_scheduled_at, now()),
    p_dedupe_key, p_origin, p_origin_id, p_channel_id)
  on conflict (workspace_id, dedupe_key) where dedupe_key is not null
  do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id from public.send_queue
     where workspace_id = p_workspace_id and dedupe_key = p_dedupe_key;
  end if;

  return v_id;
end $$;

-- ---------------------------------------------------------------------------
-- 6. Conversa garantida — uma conversa ativa por contato e canal
-- ---------------------------------------------------------------------------
create or replace function public.flow_ensure_conversation(
  p_workspace_id uuid,
  p_contact_id   uuid,
  p_channel      text default 'whatsapp'
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  select id into v_id from public.conversations
   where workspace_id = p_workspace_id
     and contact_id = p_contact_id
     and channel = p_channel
     and is_active
   order by last_message_at desc nulls last
   limit 1;

  if v_id is null then
    insert into public.conversations (
      workspace_id, contact_id, channel, status, is_active, started_at, last_message_at)
    values (p_workspace_id, p_contact_id, p_channel, 'nina'::conversation_status, true, now(), now())
    returning id into v_id;
  end if;

  return v_id;
end $$;

-- ---------------------------------------------------------------------------
-- 7. O NÓ DA CONCATENAÇÃO — mensagem de entrada.
--    Uma chamada faz o fluxo inteiro avançar: deduplica, garante conversa,
--    grava mensagem, PARA A CADÊNCIA, garante o deal e escreve a timeline.
--    É a regra que os três sistemas separados não conseguiam ter.
-- ---------------------------------------------------------------------------
create or replace function public.flow_ingest_inbound(
  p_workspace_id        uuid,
  p_provider            text,
  p_provider_message_id text,
  p_phone               text,
  p_content             text,
  p_message_type        text default 'text',
  p_media_url           text default null,
  p_contact_name        text default null,
  p_channel             text default 'whatsapp'
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contact uuid;
  v_conv    uuid;
  v_msg     uuid;
  v_deal    uuid;
  v_paradas    integer := 0;
  v_cancelados integer := 0;
begin
  if coalesce(trim(p_provider_message_id),'') = '' then
    raise exception 'flow_ingest_inbound: provider_message_id é obrigatório — sem ele não há idempotência';
  end if;

  -- 1) a mensagem já entrou antes? devolve o estado, não reprocessa nada.
  select m.id, m.conversation_id into v_msg, v_conv
    from public.messages m
   where m.workspace_id = p_workspace_id
     and m.provider_message_id = p_provider_message_id;

  if v_msg is not null then
    select c.contact_id into v_contact from public.conversations c where c.id = v_conv;
    return jsonb_build_object('duplicada', true, 'message_id', v_msg,
                              'conversation_id', v_conv, 'contact_id', v_contact);
  end if;

  -- 2) contato e conversa
  v_contact := public.flow_upsert_contact(
      p_workspace_id, coalesce(p_contact_name, p_phone), p_phone,
      null, null, null, false, 'inbound');
  v_conv := public.flow_ensure_conversation(p_workspace_id, v_contact, p_channel);

  -- 3) mensagem
  insert into public.messages (
    workspace_id, conversation_id, type, from_type, content, media_url,
    status, provider, provider_message_id, whatsapp_message_id, sent_at)
  values (
    p_workspace_id, v_conv, p_message_type::message_type, 'user'::message_from,
    p_content, p_media_url, 'delivered'::message_status,
    p_provider, p_provider_message_id,
    case when p_provider = 'meta' then p_provider_message_id end, now())
  on conflict (workspace_id, provider_message_id) where provider_message_id is not null
  do nothing
  returning id into v_msg;

  if v_msg is null then  -- corrida: outro worker gravou entre o select e o insert
    select id into v_msg from public.messages
     where workspace_id = p_workspace_id and provider_message_id = p_provider_message_id;
    return jsonb_build_object('duplicada', true, 'message_id', v_msg,
                              'conversation_id', v_conv, 'contact_id', v_contact);
  end if;
  update public.conversations
     set last_message_at = now(), is_active = true, updated_at = now()
   where id = v_conv;

  update public.contacts
     set last_activity = now(), updated_at = now()
   where id = v_contact;

  -- 4) A RESPOSTA DO LEAD MATA A CADÊNCIA.
  --    Sem isto o contato responde e continua recebendo follow-up automático —
  --    a dupla escrita clássica deste merge.
  with paradas as (
    update public.followup_enrollments e
       set status = case s.on_reply_behavior when 'pause' then 'paused' else 'stopped' end,
           stop_reason  = 'resposta_do_lead',
           completed_at = case when s.on_reply_behavior = 'stop' then now() else e.completed_at end,
           next_send_at = null
      from public.followup_sequences s
     where e.sequence_id = s.id
       and e.contact_id = v_contact
       and e.status = 'active'
       and s.on_reply_behavior <> 'continue'
    returning e.id)
  select count(*) into v_paradas from paradas;

  -- 5) cancela envio ainda não disparado para este contato
  with cancelados as (
    update public.send_queue
       set status = 'failed'::queue_status, error_message = 'cancelado: lead respondeu'
     where workspace_id = p_workspace_id
       and contact_id = v_contact
       and status = 'pending'
       and origin in ('followup','campaign')
    returning id)
  select count(*) into v_cancelados from cancelados;

  -- 6) o CRM acompanha sozinho: quem responde vira deal
  v_deal := public.crm_ensure_deal(p_workspace_id, v_contact, 'inbound');

  -- 7) timeline
  perform public.flow_record_event(
    p_workspace_id, v_contact, 'conversa', 'mensagem_recebida',
    'Lead respondeu',
    jsonb_build_object('provider', p_provider, 'cadencias_paradas', v_paradas,
                       'envios_cancelados', v_cancelados),
    'inbound:'||p_provider||':'||p_provider_message_id,
    null, v_deal, v_conv);

  return jsonb_build_object(
    'duplicada', false, 'message_id', v_msg, 'conversation_id', v_conv,
    'contact_id', v_contact, 'deal_id', v_deal,
    'cadencias_paradas', v_paradas, 'envios_cancelados', v_cancelados);
end $$;

-- ---------------------------------------------------------------------------
-- 8. CRM — deal garantido e movimentação com atividade no mesmo bloco
-- ---------------------------------------------------------------------------
create or replace function public.crm_ensure_deal(
  p_workspace_id uuid,
  p_contact_id   uuid,
  p_source       text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id    uuid;
  v_stage uuid;
  v_nome  text;
  v_comp  uuid;
begin
  select id into v_id from public.deals
   where workspace_id = p_workspace_id and contact_id = p_contact_id
     and won_at is null and lost_at is null
   limit 1;
  if v_id is not null then return v_id; end if;

  select name, lead_company_id into v_nome, v_comp
    from public.contacts where id = p_contact_id;

  select id into v_stage from public.pipeline_stages
   where workspace_id = p_workspace_id and is_active
   order by position limit 1;

  if v_stage is null then
    insert into public.pipeline_stages (workspace_id, title, color, position, is_system, is_active)
    values (p_workspace_id, 'Novo', '#64748b', 1, true, true)
    on conflict (workspace_id, position) do nothing
    returning id into v_stage;
    if v_stage is null then
      select id into v_stage from public.pipeline_stages
       where workspace_id = p_workspace_id order by position limit 1;
    end if;
  end if;

  insert into public.deals (workspace_id, contact_id, lead_company_id, title, stage_id, source)
  values (p_workspace_id, p_contact_id, v_comp, coalesce(v_nome,'Sem nome'), v_stage, p_source)
  on conflict do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id from public.deals
     where workspace_id = p_workspace_id and contact_id = p_contact_id
       and won_at is null and lost_at is null limit 1;
    return v_id;
  end if;

  perform public.flow_record_event(
    p_workspace_id, p_contact_id, 'crm', 'deal_criado', 'Oportunidade aberta',
    jsonb_build_object('source', p_source), 'deal_criado:'||v_id::text, v_comp, v_id);

  return v_id;
end $$;

create or replace function public.crm_move_deal(
  p_deal_id     uuid,
  p_stage_id    uuid,
  p_motivo      text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ws uuid; v_contact uuid; v_antes uuid; v_titulo text; v_novo text;
begin
  select workspace_id, contact_id, stage_id into v_ws, v_contact, v_antes
    from public.deals where id = p_deal_id;
  if v_ws is null then
    raise exception 'crm_move_deal: deal % não existe', p_deal_id;
  end if;

  select title into v_novo from public.pipeline_stages
   where id = p_stage_id and workspace_id = v_ws;
  if v_novo is null then
    raise exception 'crm_move_deal: estágio % não pertence ao workspace do deal', p_stage_id;
  end if;

  if v_antes is not distinct from p_stage_id then
    return;  -- mover para onde já está não gera atividade duplicada
  end if;

  update public.deals set stage_id = p_stage_id, updated_at = now() where id = p_deal_id;

  insert into public.deal_activities (
    workspace_id, deal_id, type, title, description, is_completed, completed_at, created_by)
  values (v_ws, p_deal_id, 'stage_change', 'Movido para '||v_novo, p_motivo, true, now(), auth.uid());

  perform public.flow_record_event(
    v_ws, v_contact, 'crm', 'deal_movido', 'Oportunidade movida para '||v_novo,
    jsonb_build_object('de', v_antes, 'para', p_stage_id, 'motivo', p_motivo),
    null, null, p_deal_id);
end $$;

-- ---------------------------------------------------------------------------
-- 9. Bloqueio de contato — uma porta, e ela para o fluxo inteiro
-- ---------------------------------------------------------------------------
create or replace function public.contact_block(
  p_contact_id uuid,
  p_motivo     text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_ws uuid;
begin
  update public.contacts
     set is_blocked = true, blocked_at = now(), blocked_reason = p_motivo, updated_at = now()
   where id = p_contact_id
  returning workspace_id into v_ws;

  if v_ws is null then
    raise exception 'contact_block: contato % não existe', p_contact_id;
  end if;

  update public.followup_enrollments
     set status = 'stopped', stop_reason = 'contato_bloqueado', completed_at = now(), next_send_at = null
   where contact_id = p_contact_id and status in ('active','paused');

  update public.send_queue
     set status = 'failed'::queue_status, error_message = 'cancelado: contato bloqueado'
   where contact_id = p_contact_id and status = 'pending';

  perform public.flow_record_event(
    v_ws, p_contact_id, 'cadencia', 'contato_bloqueado', 'Contato bloqueado',
    jsonb_build_object('motivo', p_motivo), 'bloqueio:'||p_contact_id::text);
end $$;

-- ---------------------------------------------------------------------------
-- 10. Webhook idempotente — a borda de entrada
-- ---------------------------------------------------------------------------
create or replace function public.webhook_claim(
  p_workspace_id      uuid,
  p_provider          text,
  p_provider_event_id text,
  p_event_type        text default null,
  p_payload           jsonb default '{}'::jsonb
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  insert into public.webhook_events (
    workspace_id, provider, provider_event_id, event_type, payload)
  values (p_workspace_id, p_provider, p_provider_event_id, p_event_type, p_payload)
  on conflict (workspace_id, provider, provider_event_id) do nothing
  returning id into v_id;

  return v_id is not null;  -- true = primeira vez, pode processar
end $$;

-- ---------------------------------------------------------------------------
-- 11. A visão do fluxo inteiro — uma linha por contato, todas as etapas
-- ---------------------------------------------------------------------------
create or replace view public.v_flow_pipeline as
select
  c.workspace_id,
  c.id                         as contact_id,
  c.name                       as contato,
  c.phone_e164,
  c.role_title,
  c.is_decision_maker,
  c.lifecycle_status,
  c.enrichment_score,
  lc.id                        as company_id,
  lc.name                      as empresa,
  lc.domain,
  lc.industry,
  (select count(*) from public.followup_enrollments e
    where e.contact_id = c.id and e.status = 'active')          as cadencias_ativas,
  (select count(*) from public.messages m
     join public.conversations cv on cv.id = m.conversation_id
    where cv.contact_id = c.id)                                 as mensagens,
  (select max(m.sent_at) from public.messages m
     join public.conversations cv on cv.id = m.conversation_id
    where cv.contact_id = c.id and m.from_type = 'user')        as ultima_resposta,
  d.id                         as deal_id,
  d.title                      as oportunidade,
  d.value                      as valor,
  ps.title                     as estagio,
  case
    when d.won_at is not null                                   then 'fechamento'
    when d.id is not null                                       then 'crm'
    when exists (select 1 from public.conversations cv
                  where cv.contact_id = c.id)                   then 'conversa'
    when exists (select 1 from public.followup_enrollments e
                  where e.contact_id = c.id and e.status = 'active') then 'cadencia'
    when c.enrichment_score is not null                         then 'enriquecimento'
    else 'prospeccao'
  end                          as etapa_atual,
  c.created_at,
  c.last_activity
from public.contacts c
left join public.lead_companies lc on lc.id = c.lead_company_id
left join public.deals d on d.contact_id = c.id and d.won_at is null and d.lost_at is null
left join public.pipeline_stages ps on ps.id = d.stage_id;

comment on view public.v_flow_pipeline is
  'O fluxo visto como um inteiro: uma linha por contato, da busca que o encontrou até o deal.';
