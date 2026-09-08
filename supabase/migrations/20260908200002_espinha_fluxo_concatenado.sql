-- ============================================================================
-- Confluência · Fase 2 · Bloco 2/4 — Espinha: o fluxo concatenado
-- ----------------------------------------------------------------------------
-- O produto é UM fluxo, não quatro telas:
--
--   busca → EMPRESA → DECISOR → lista → CADÊNCIA → envio → CONVERSA → DEAL
--
-- Cada seta abaixo é uma FK real. Onde a seta não existe, o fluxo quebra e o
-- operador tem que reconciliar na mão — que é exatamente o que os três sistemas
-- separados faziam hoje.
--
-- Traz do doador `blank-canvas-project-29` (prospecção e cadência) e do doador
-- `whatsapp-flow-api-oficial-remix` (listas N:N, campanhas, Meta oficial), já
-- nascendo com workspace_id e com chave de idempotência.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0. Normalização de telefone — a chave natural do contato
--    Sem isto, "+55 11 91234-5678", "5511912345678" e "011912345678" viram
--    três contatos e o fluxo se parte no primeiro passo.
-- ---------------------------------------------------------------------------
create or replace function public.normalize_phone(p_raw text)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare d text; local8 text;
begin
  if p_raw is null then return null; end if;
  d := split_part(p_raw, ':', 1);              -- corta sufixo de device do WhatsApp
  d := regexp_replace(d, '\D', '', 'g');
  if d = '' then return null; end if;

  -- prefixo de operadora/trunk: 0XX -> XX
  if length(d) in (11, 12) and left(d, 1) = '0' then
    d := substr(d, 2);
  end if;

  -- sem DDI: 10 (fixo) ou 11 (celular) dígitos -> prefixa 55
  if length(d) in (10, 11) then
    d := '55' || d;
  end if;

  -- 55 + DDD + 8 dígitos: só ganha o nono dígito se for CELULAR (local começa em 6-9).
  -- Fixo (2-5) tem 8 dígitos por natureza e não pode ser convertido: inserir o 9
  -- num 11 3214-5678 inventa um número que não existe.
  if length(d) = 12 and left(d, 2) = '55' then
    local8 := right(d, 8);
    if left(local8, 1) in ('6','7','8','9') then
      d := left(d, 4) || '9' || local8;
    end if;
  end if;

  return '+' || d;
end $$;

-- ---------------------------------------------------------------------------
-- 1. ETAPA 1 — EMPRESA prospectada
-- ---------------------------------------------------------------------------
create table if not exists public.lead_companies (
  id                uuid primary key default gen_random_uuid(),
  workspace_id      uuid not null references public.workspaces(id) on delete cascade,
  name              text not null,
  domain            text,
  cnpj              text,
  website           text,
  linkedin_url      text,
  instagram         text,
  facebook          text,
  phone             text,
  whatsapp          text,
  email             text,
  industry          text,
  description       text,
  services          text[],
  employees_count   integer,
  revenue           text,
  founding_year     integer,
  address           text,
  city              text,
  ai_score          numeric,
  ai_summary        text,
  apollo_org_id     text,
  search_id         uuid,
  legacy_source     text,
  legacy_id         text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create unique index if not exists uq_lead_companies_workspace_domain
  on public.lead_companies (workspace_id, lower(domain)) where domain is not null;
create unique index if not exists uq_lead_companies_workspace_cnpj
  on public.lead_companies (workspace_id, cnpj) where cnpj is not null;
create unique index if not exists uq_lead_companies_legacy
  on public.lead_companies (legacy_source, legacy_id) where legacy_id is not null;
create index if not exists idx_lead_companies_workspace on public.lead_companies (workspace_id);

create table if not exists public.lead_searches (
  id                uuid primary key default gen_random_uuid(),
  workspace_id      uuid not null references public.workspaces(id) on delete cascade,
  name              text not null,
  source            text not null default 'apollo',
  config            jsonb not null default '{}'::jsonb,
  status            text not null default 'pending',
  contacts_found    integer not null default 0,
  contacts_new      integer not null default 0,
  contacts_enriched integer not null default 0,
  target_list_id    uuid,
  result_data       jsonb,
  error_message     text,
  enrich_run_id     text,
  enrich_cursor     text,
  enrich_step       text,
  enrich_heartbeat  timestamptz,
  started_at        timestamptz,
  completed_at      timestamptz,
  duration_ms       integer,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists idx_lead_searches_workspace on public.lead_searches (workspace_id);

create table if not exists public.scraping_jobs (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references public.workspaces(id) on delete cascade,
  url             text not null,
  fields          jsonb not null default '{}'::jsonb,
  status          text not null default 'pending',
  contacts_found  integer not null default 0,
  contacts_valid  integer not null default 0,
  target_list_id  uuid,
  result_data     jsonb,
  error_message   text,
  started_at      timestamptz,
  completed_at    timestamptz,
  duration_ms     integer,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_scraping_jobs_workspace on public.scraping_jobs (workspace_id);

alter table public.lead_companies
  add constraint lead_companies_search_fk
  foreign key (search_id) references public.lead_searches(id) on delete set null
  not valid;

-- ---------------------------------------------------------------------------
-- 2. ETAPA 2 — DECISOR: o contato ganha o elo com a empresa e a chave natural
-- ---------------------------------------------------------------------------
alter table public.contacts
  add column if not exists lead_company_id   uuid references public.lead_companies(id) on delete set null,
  add column if not exists role_title        text,
  add column if not exists is_decision_maker boolean not null default false,
  add column if not exists enrichment_score  numeric,
  add column if not exists lifecycle_status  text not null default 'novo',
  add column if not exists source            text,
  add column if not exists phone_e164        text,
  add column if not exists legacy_source     text,
  add column if not exists legacy_id         text;

comment on column public.contacts.lifecycle_status is
  'Estado do contato no fluxo. Autoridade exclusiva da RPC crm_set_lifecycle().';
comment on column public.contacts.enrichment_score is
  'Score de enriquecimento. Autoridade exclusiva da prospecção (lead_enrich_apply).';

-- phone_e164 é derivada e mantida por trigger: nunca escrita à mão.
create or replace function public.tg_contacts_normalize_phone()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.phone_e164 := public.normalize_phone(coalesce(new.phone_number, new.whatsapp_id));
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_contacts_normalize_phone on public.contacts;
create trigger trg_contacts_normalize_phone
  before insert or update of phone_number, whatsapp_id on public.contacts
  for each row execute function public.tg_contacts_normalize_phone();

update public.contacts
   set phone_e164 = public.normalize_phone(coalesce(phone_number, whatsapp_id))
 where phone_e164 is null;

-- A chave natural do fluxo inteiro.
create unique index if not exists uq_contacts_workspace_phone
  on public.contacts (workspace_id, phone_e164) where phone_e164 is not null;
create unique index if not exists uq_contacts_workspace_email
  on public.contacts (workspace_id, lower(email)) where email is not null;
create unique index if not exists uq_contacts_legacy
  on public.contacts (legacy_source, legacy_id) where legacy_id is not null;
create index if not exists idx_contacts_company on public.contacts (lead_company_id);

-- ---------------------------------------------------------------------------
-- 3. ETAPA 3 — LISTA (N:N, do doador WA; o list_id 1:N do BC morre aqui)
-- ---------------------------------------------------------------------------
create table if not exists public.contact_lists (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name         text not null,
  source       text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create unique index if not exists uq_contact_lists_workspace_name
  on public.contact_lists (workspace_id, lower(name));

create table if not exists public.contact_list_members (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  list_id      uuid not null references public.contact_lists(id) on delete cascade,
  contact_id   uuid not null references public.contacts(id) on delete cascade,
  created_at   timestamptz not null default now()
);
create unique index if not exists uq_contact_list_members
  on public.contact_list_members (list_id, contact_id);

-- ---------------------------------------------------------------------------
-- 4. ETAPA 4 — CADÊNCIA de follow-up (doador BC)
-- ---------------------------------------------------------------------------
create table if not exists public.followup_sequences (
  id                 uuid primary key default gen_random_uuid(),
  workspace_id       uuid not null references public.workspaces(id) on delete cascade,
  name               text not null,
  description        text,
  status             text not null default 'draft',
  trigger_type       text not null default 'manual',
  trigger_config     jsonb not null default '{}'::jsonb,
  filters            jsonb not null default '{}'::jsonb,
  on_reply_behavior  text not null default 'stop',
  send_window        jsonb not null default '{}'::jsonb,
  timezone           text not null default 'America/Sao_Paulo',
  min_interval_hours integer not null default 24,
  max_attempts       integer not null default 5,
  ttl_days           integer,
  post_actions       jsonb not null default '{}'::jsonb,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint followup_sequences_on_reply_ck
    check (on_reply_behavior in ('stop','pause','continue'))
);
create unique index if not exists uq_followup_sequences_workspace_name
  on public.followup_sequences (workspace_id, lower(name));

create table if not exists public.followup_steps (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  sequence_id   uuid not null references public.followup_sequences(id) on delete cascade,
  position      integer not null,
  content       text,
  content_type  text not null default 'text',
  media_urls    text[],
  ab_variants   jsonb,
  delay_type    text not null default 'relative',
  delay_value   integer not null default 1,
  delay_unit    text not null default 'days',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create unique index if not exists uq_followup_steps_sequence_position
  on public.followup_steps (sequence_id, position);

create table if not exists public.followup_enrollments (
  id             uuid primary key default gen_random_uuid(),
  workspace_id   uuid not null references public.workspaces(id) on delete cascade,
  sequence_id    uuid not null references public.followup_sequences(id) on delete cascade,
  contact_id     uuid not null references public.contacts(id) on delete cascade,
  deal_id        uuid references public.deals(id) on delete set null,
  status         text not null default 'active',
  current_step   integer not null default 0,
  next_send_at   timestamptz,
  trigger_data   jsonb not null default '{}'::jsonb,
  variables      jsonb not null default '{}'::jsonb,
  stop_reason    text,
  enrolled_at    timestamptz not null default now(),
  completed_at   timestamptz,
  constraint followup_enrollments_status_ck
    check (status in ('active','paused','completed','stopped'))
);

-- Idempotência da inscrição: um contato só tem UMA inscrição viva por sequência.
create unique index if not exists uq_followup_enrollment_ativa
  on public.followup_enrollments (sequence_id, contact_id)
  where status in ('active','paused');
create index if not exists idx_followup_enrollments_due
  on public.followup_enrollments (next_send_at) where status = 'active';

create table if not exists public.followup_logs (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  enrollment_id uuid not null references public.followup_enrollments(id) on delete cascade,
  step_position integer,
  action        text not null,
  reason        text,
  message_id    uuid,
  sent_at       timestamptz not null default now()
);
-- Idempotência do disparo: um passo só é enviado uma vez por inscrição.
create unique index if not exists uq_followup_logs_envio_unico
  on public.followup_logs (enrollment_id, step_position)
  where action = 'sent';

-- ---------------------------------------------------------------------------
-- 5. ETAPA 5 — CAMPANHA de disparo (doador WA + rotação do BC)
-- ---------------------------------------------------------------------------
create table if not exists public.broadcast_campaigns (
  id                  uuid primary key default gen_random_uuid(),
  workspace_id        uuid not null references public.workspaces(id) on delete cascade,
  name                text not null,
  status              text not null default 'draft',
  list_id             uuid references public.contact_lists(id) on delete set null,
  channel_id          uuid,
  message_type        text not null default 'text',
  message_template    text,
  media_urls          text[],
  media_rotation_mode text,
  rotation_strategy   text,
  batch_size          integer not null default 50,
  delay_min_ms        integer not null default 3000,
  delay_max_ms        integer not null default 8000,
  total_recipients    integer not null default 0,
  sent_count          integer not null default 0,
  failed_count        integer not null default 0,
  next_batch_at       timestamptz,
  started_at          timestamptz,
  completed_at        timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists idx_broadcast_campaigns_workspace on public.broadcast_campaigns (workspace_id);

create table if not exists public.broadcast_recipients (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  campaign_id   uuid not null references public.broadcast_campaigns(id) on delete cascade,
  contact_id    uuid not null references public.contacts(id) on delete cascade,
  status        text not null default 'pending',
  variables     jsonb not null default '{}'::jsonb,
  sent_media_url text,
  error_message text,
  sent_at       timestamptz,
  created_at    timestamptz not null default now()
);
-- Idempotência da campanha: um contato não recebe a mesma campanha duas vezes.
create unique index if not exists uq_broadcast_recipient_unico
  on public.broadcast_recipients (campaign_id, contact_id);

-- ---------------------------------------------------------------------------
-- 6. CANAL unificado — Zernio, Meta oficial e Evolution atrás de um registro só
-- ---------------------------------------------------------------------------
alter table public.channel_connections
  add column if not exists external_account_id text,
  add column if not exists phone_e164          text,
  add column if not exists is_default          boolean not null default false;

alter table public.channel_connections alter column zernio_account_id drop not null;

update public.channel_connections
   set external_account_id = coalesce(external_account_id, zernio_account_id)
 where external_account_id is null;

create unique index if not exists uq_channels_workspace_provider_account
  on public.channel_connections (workspace_id, provider, external_account_id)
  where external_account_id is not null;

-- Credencial do canal fora da tabela de leitura: nunca exposta ao front.
create table if not exists public.channel_secrets (
  channel_id   uuid primary key references public.channel_connections(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  waba_id          text,
  phone_number_id  text,
  access_token     text,
  extra            jsonb not null default '{}'::jsonb,
  updated_at   timestamptz not null default now()
);

-- Template HSM aprovado pela Meta (≠ message_snippets, que é texto livre)
create table if not exists public.meta_templates (
  id               uuid primary key default gen_random_uuid(),
  workspace_id     uuid not null references public.workspaces(id) on delete cascade,
  channel_id       uuid references public.channel_connections(id) on delete cascade,
  meta_template_id text,
  name             text not null,
  language         text not null default 'pt_BR',
  category         text,
  components       jsonb not null default '[]'::jsonb,
  samples          jsonb,
  labels           text[],
  status           text not null default 'PENDING',
  validation_score numeric,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create unique index if not exists uq_meta_templates_workspace_name_lang
  on public.meta_templates (workspace_id, name, language);

create table if not exists public.message_snippets (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  name          text not null,
  category      text,
  message_type  text not null default 'text',
  content       text,
  media_urls    text[],
  tags          text[],
  is_ai_generated boolean not null default false,
  usage_count   integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create unique index if not exists uq_message_snippets_workspace_name
  on public.message_snippets (workspace_id, lower(name));

-- ---------------------------------------------------------------------------
-- 7. IDEMPOTÊNCIA de borda — webhook de entrada e envio de saída
-- ---------------------------------------------------------------------------

-- 7a. Webhook: uma tabela para os três provedores.
create table if not exists public.webhook_events (
  id                 uuid primary key default gen_random_uuid(),
  workspace_id       uuid not null references public.workspaces(id) on delete cascade,
  provider           text not null,
  provider_event_id  text not null,
  event_type         text,
  payload            jsonb not null default '{}'::jsonb,
  processed          boolean not null default false,
  processed_at       timestamptz,
  error              text,
  created_at         timestamptz not null default now()
);
-- O mesmo evento entregue duas vezes é UMA linha.
create unique index if not exists uq_webhook_events_provider_event
  on public.webhook_events (workspace_id, provider, provider_event_id);

-- 7b. Envio: chave de deduplicação na fila.
alter table public.send_queue
  add column if not exists dedupe_key    text,
  add column if not exists origin        text,
  add column if not exists origin_id     uuid,
  add column if not exists channel_id    uuid references public.channel_connections(id) on delete set null,
  add column if not exists provider_message_id text;

comment on column public.send_queue.dedupe_key is
  'Chave de idempotência do envio. Reenfileirar a mesma chave não cria segunda linha.';
comment on column public.send_queue.origin is
  'Quem pediu o envio: campaign | followup | flow | inbox | agent.';

create unique index if not exists uq_send_queue_dedupe
  on public.send_queue (workspace_id, dedupe_key) where dedupe_key is not null;
create unique index if not exists uq_send_queue_provider_message
  on public.send_queue (workspace_id, provider_message_id) where provider_message_id is not null;
create index if not exists idx_send_queue_pendente
  on public.send_queue (scheduled_at) where status = 'pending';

-- 7c. Mensagem: dedup por id do provedor, seja qual for.
alter table public.messages
  add column if not exists provider            text,
  add column if not exists provider_message_id text;

update public.messages
   set provider_message_id = coalesce(provider_message_id, whatsapp_message_id, zernio_message_id)
 where provider_message_id is null;

create unique index if not exists uq_messages_workspace_provider_message
  on public.messages (workspace_id, provider_message_id) where provider_message_id is not null;

-- ---------------------------------------------------------------------------
-- 8. O ELO QUE FALTAVA — linha do tempo única do contato
--    É o que permite ver o fluxo como um inteiro: a mesma pessoa, da busca que
--    a encontrou até o deal ganho, numa sequência só, sem trocar de tela.
-- ---------------------------------------------------------------------------
create table if not exists public.journey_events (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  contact_id   uuid not null references public.contacts(id) on delete cascade,
  company_id   uuid references public.lead_companies(id) on delete set null,
  deal_id      uuid references public.deals(id) on delete set null,
  conversation_id uuid references public.conversations(id) on delete set null,
  stage        text not null,
  event_type   text not null,
  title        text not null,
  detail       jsonb not null default '{}'::jsonb,
  dedupe_key   text,
  occurred_at  timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  constraint journey_events_stage_ck check (stage in
    ('prospeccao','enriquecimento','cadencia','conversa','crm','fechamento'))
);
-- Idempotência da timeline: o mesmo fato registrado duas vezes é uma linha.
create unique index if not exists uq_journey_events_dedupe
  on public.journey_events (workspace_id, dedupe_key) where dedupe_key is not null;
create index if not exists idx_journey_events_contato
  on public.journey_events (workspace_id, contact_id, occurred_at desc);

-- ---------------------------------------------------------------------------
-- 9. Elos que faltavam nas tabelas do trunk
-- ---------------------------------------------------------------------------
alter table public.deals
  add column if not exists lead_company_id uuid references public.lead_companies(id) on delete set null,
  add column if not exists source          text,
  add column if not exists legacy_source   text,
  add column if not exists legacy_id       text;

create unique index if not exists uq_deals_legacy
  on public.deals (legacy_source, legacy_id) where legacy_id is not null;

-- Um contato não tem dois deals abertos ao mesmo tempo: isso é a duplicidade
-- clássica de CRM alimentado por prospecção e por inbox ao mesmo tempo.
create unique index if not exists uq_deals_contato_aberto
  on public.deals (workspace_id, contact_id)
  where contact_id is not null and won_at is null and lost_at is null;

create unique index if not exists uq_pipeline_stages_workspace_position
  on public.pipeline_stages (workspace_id, position);
