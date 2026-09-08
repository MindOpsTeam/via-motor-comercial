-- ============================================================================
-- Confluência · Fase 2 · Bloco 1/4 — Espinha: tenancy unificada
-- ----------------------------------------------------------------------------
-- Problema que resolve: a tenancy chegou partida em três estados diferentes.
--   workspace_id  -> agents, agent_*, knowledge_*, eval_*, appointments
--   user_id       -> contacts, conversations, deals, pipeline_stages, teams...
--   nenhuma       -> deal_activities, send_queue, messages, filas, canais
-- Sem uma fronteira só, RLS vira remendo e o dado de um cliente vaza no outro.
--
-- Depois deste bloco: TODA tabela de negócio carrega workspace_id NOT NULL.
-- Reaplicável: IF NOT EXISTS / CREATE OR REPLACE / backfill idempotente.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Workspace semente (só se não houver nenhum)
-- ---------------------------------------------------------------------------
insert into public.workspaces (name, slug, status)
select 'Viver de IA', 'viver-de-ia', 'active'
where not exists (select 1 from public.workspaces);

create or replace function public.default_workspace_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.workspaces order by created_at, id limit 1
$$;

comment on function public.default_workspace_id() is
  'Workspace de fallback para backfill e para instalação single-tenant. Nunca use em RLS.';

-- ---------------------------------------------------------------------------
-- 2. Coluna workspace_id em toda tabela de negócio
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'contacts','conversations','deals','pipeline_stages','nina_settings',
    'tag_definitions','teams','team_members','team_functions','deal_activities',
    'messages','conversation_states','send_queue','nina_processing_queue',
    'message_processing_queue','message_grouping_queue','channel_connections',
    'calendar_integrations','calendar_oauth_states','prompt_versions',
    'zernio_webhook_events'
  ]
  loop
    if to_regclass('public.'||t) is not null then
      execute format(
        'alter table public.%I add column if not exists workspace_id uuid
           references public.workspaces(id) on delete cascade', t);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Backfill — na ordem das dependências
-- ---------------------------------------------------------------------------

-- 3a. tabelas que já tinham user_id: workspace do membro; senão o default
do $$
declare t text;
begin
  foreach t in array array[
    'contacts','conversations','deals','pipeline_stages','nina_settings',
    'tag_definitions','teams','team_members','team_functions','calendar_oauth_states'
  ]
  loop
    execute format($f$
      update public.%I x
         set workspace_id = coalesce(
               (select wm.workspace_id from public.workspace_members wm
                 where wm.user_id = x.user_id and wm.status = 'active'
                 order by wm.created_at limit 1),
               public.default_workspace_id())
       where x.workspace_id is null
    $f$, t);
  end loop;
end $$;

-- 3b. derivadas da conversa
update public.messages m
   set workspace_id = c.workspace_id
  from public.conversations c
 where m.conversation_id = c.id and m.workspace_id is null;

update public.conversation_states s
   set workspace_id = c.workspace_id
  from public.conversations c
 where s.conversation_id = c.id and s.workspace_id is null;

update public.send_queue q
   set workspace_id = c.workspace_id
  from public.conversations c
 where q.conversation_id = c.id and q.workspace_id is null;

update public.nina_processing_queue q
   set workspace_id = c.workspace_id
  from public.conversations c
 where q.conversation_id = c.id and q.workspace_id is null;

-- 3c. derivada do deal
update public.deal_activities a
   set workspace_id = d.workspace_id
  from public.deals d
 where a.deal_id = d.id and a.workspace_id is null;

-- 3d. o que sobrou (filas sem conversa, canais, webhooks, versões de prompt)
do $$
declare t text;
begin
  foreach t in array array[
    'messages','conversation_states','send_queue','nina_processing_queue',
    'message_processing_queue','message_grouping_queue','deal_activities',
    'channel_connections','calendar_integrations','prompt_versions',
    'zernio_webhook_events'
  ]
  loop
    execute format(
      'update public.%I set workspace_id = public.default_workspace_id()
        where workspace_id is null', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 4. Travar: NOT NULL + índice de leitura
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'contacts','conversations','deals','pipeline_stages','nina_settings',
    'tag_definitions','teams','team_members','team_functions','deal_activities',
    'messages','conversation_states','send_queue','nina_processing_queue',
    'message_processing_queue','message_grouping_queue','channel_connections',
    'calendar_integrations','calendar_oauth_states','prompt_versions',
    'zernio_webhook_events'
  ]
  loop
    execute format('alter table public.%I alter column workspace_id set not null', t);
    execute format('create index if not exists idx_%1$s_workspace on public.%1$I (workspace_id)', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 5. Chaves naturais: de globais para por-workspace
--    Um unique global em ambiente multi-tenant é bug, não proteção: impede que
--    dois clientes tenham o mesmo telefone, o mesmo e-mail ou o mesmo provedor.
-- ---------------------------------------------------------------------------
drop index if exists public.contacts_phone_number_unique;
drop index if exists public.idx_contacts_instagram_user_id;
drop index if exists public.team_members_email_key;
drop index if exists public.calendar_integrations_provider_key;
drop index if exists public.nina_settings_user_id_unique;
drop index if exists public.tag_definitions_user_key_unique;
drop index if exists public.teams_user_name_unique;
drop index if exists public.team_functions_user_name_unique;
drop index if exists public.channel_connections_provider_account_unique;
drop index if exists public.idx_conversations_zernio_conversation_id;

alter table public.team_members            drop constraint if exists team_members_email_key;
alter table public.calendar_integrations   drop constraint if exists calendar_integrations_provider_key;
alter table public.nina_settings           drop constraint if exists nina_settings_user_id_unique;
alter table public.tag_definitions         drop constraint if exists tag_definitions_user_key_unique;
alter table public.teams                   drop constraint if exists teams_user_name_unique;
alter table public.team_functions          drop constraint if exists team_functions_user_name_unique;
alter table public.channel_connections     drop constraint if exists channel_connections_provider_account_unique;

create unique index if not exists uq_team_members_workspace_email
  on public.team_members (workspace_id, lower(email));
create unique index if not exists uq_calendar_integrations_workspace_provider
  on public.calendar_integrations (workspace_id, provider);
create unique index if not exists uq_nina_settings_workspace
  on public.nina_settings (workspace_id);
create unique index if not exists uq_tag_definitions_workspace_key
  on public.tag_definitions (workspace_id, key);
create unique index if not exists uq_teams_workspace_name
  on public.teams (workspace_id, name);
create unique index if not exists uq_team_functions_workspace_name
  on public.team_functions (workspace_id, name);
create unique index if not exists uq_channel_connections_workspace_provider_account
  on public.channel_connections (workspace_id, provider, zernio_account_id);
create unique index if not exists uq_conversations_workspace_zernio
  on public.conversations (workspace_id, zernio_conversation_id)
  where zernio_conversation_id is not null;
create unique index if not exists uq_contacts_workspace_instagram
  on public.contacts (workspace_id, instagram_user_id)
  where instagram_user_id is not null;

-- ---------------------------------------------------------------------------
-- 6. Guardas de permissão (base da fase 5)
-- ---------------------------------------------------------------------------
create or replace function public.is_workspace_member(_workspace_id uuid, _user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members
     where workspace_id = _workspace_id
       and user_id = _user_id
       and status = 'active')
$$;

create or replace function public.is_workspace_admin(_workspace_id uuid, _user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members
     where workspace_id = _workspace_id
       and user_id = _user_id
       and status = 'active'
       and role = 'admin')
$$;

-- Workspace corrente do usuário autenticado. Porta única de leitura da fronteira.
create or replace function public.current_workspace_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select wm.workspace_id
    from public.workspace_members wm
   where wm.user_id = auth.uid()
     and wm.status = 'active'
   order by wm.created_at
   limit 1
$$;
