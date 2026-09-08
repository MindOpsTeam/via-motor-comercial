-- ============================================================================
-- Confluência · Fase 5 · Bloco 4/4 — Permissão por domínio
-- ----------------------------------------------------------------------------
-- Gerado a partir da classificação de domínio, não escrito tabela a tabela.
--
-- Três domínios, três regras:
--   NEGOCIO  — o time do workspace lê e escreve. RLS por is_workspace_member.
--   MAQUINA  — filas e bordas. Só o service_role (edge functions). Nenhum
--              cliente autenticado toca; policy alguma para `authenticated`.
--   PESSOAL  — perfil e papel global do usuário. RLS por auth.uid().
--
-- O retrato mostrou 7 tabelas com RLS ligada e ZERO policy — que na prática é
-- uma tabela invisível para todo mundo e um bug esperando o primeiro SELECT.
-- Aqui cada uma passa a ter regra declarada.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. DOMÍNIO NEGÓCIO — acesso pelo workspace
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
  negocio text[] := array[
    -- espinha do fluxo
    'contacts','conversations','messages','conversation_states','deals',
    'deal_activities','pipeline_stages','journey_events',
    -- prospecção
    'lead_companies','lead_searches','scraping_jobs',
    -- listas e cadência
    'contact_lists','contact_list_members','followup_sequences','followup_steps',
    'followup_enrollments','followup_logs',
    -- campanha
    'broadcast_campaigns','broadcast_recipients',
    -- canais e conteúdo
    'channel_connections','meta_templates','message_snippets',
    -- operação
    'teams','team_members','team_functions','tag_definitions','appointments',
    'nina_settings','calendar_integrations',
    -- motor de agente (protegido, mas lido pelo time)
    'agents','agent_versions','agent_drafts','agent_suggestions','agent_audit_log',
    'agent_action_runs','agent_runtime_events','knowledge_documents','knowledge_chunks',
    'knowledge_facts','golden_cases','eval_runs','eval_results','unanswered_questions',
    'prompt_versions'
  ];
begin
  foreach t in array negocio loop
    if to_regclass('public.'||t) is null then continue; end if;

    execute format('alter table public.%I enable row level security', t);

    -- limpa policy antiga de tenancy por user_id, que a fase 2 tornou errada
    execute format($p$
      do $inner$
      declare pol record;
      begin
        for pol in select policyname from pg_policies
                    where schemaname='public' and tablename=%L
        loop
          execute format('drop policy if exists %%I on public.%I', pol.policyname);
        end loop;
      end $inner$;
    $p$, t, t);

    execute format($p$
      create policy "ws_select_%1$s" on public.%1$I
        for select to authenticated
        using (public.is_workspace_member(workspace_id, auth.uid()))
    $p$, t);

    execute format($p$
      create policy "ws_insert_%1$s" on public.%1$I
        for insert to authenticated
        with check (public.is_workspace_member(workspace_id, auth.uid()))
    $p$, t);

    execute format($p$
      create policy "ws_update_%1$s" on public.%1$I
        for update to authenticated
        using (public.is_workspace_member(workspace_id, auth.uid()))
        with check (public.is_workspace_member(workspace_id, auth.uid()))
    $p$, t);

    execute format($p$
      create policy "ws_delete_%1$s" on public.%1$I
        for delete to authenticated
        using (public.is_workspace_admin(workspace_id, auth.uid()))
    $p$, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 2. DOMÍNIO MÁQUINA — filas, bordas e segredo. Só service_role.
--    RLS ligada e nenhuma policy para `authenticated` = ninguém logado lê.
--    Edge function usa service_role e passa por cima da RLS por desenho.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
  maquina text[] := array[
    'send_queue','nina_processing_queue','message_processing_queue',
    'message_grouping_queue','webhook_events','zernio_webhook_events',
    'channel_secrets','calendar_oauth_states','agent_operation_rate_limits'
  ];
begin
  foreach t in array maquina loop
    if to_regclass('public.'||t) is null then continue; end if;
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);

    execute format($p$
      do $inner$
      declare pol record;
      begin
        for pol in select policyname from pg_policies
                    where schemaname='public' and tablename=%L
        loop
          execute format('drop policy if exists %%I on public.%I', pol.policyname);
        end loop;
      end $inner$;
    $p$, t, t);

    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;

-- Exceção deliberada: o operador precisa ver a fila de envio do seu workspace
-- para saber por que uma mensagem não saiu. Leitura sim, escrita não.
create policy "ws_select_send_queue" on public.send_queue
  for select to authenticated
  using (public.is_workspace_member(workspace_id, auth.uid()));
grant select on public.send_queue to authenticated;

-- ---------------------------------------------------------------------------
-- 3. DOMÍNIO PESSOAL — perfil e papel global
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
drop policy if exists "profiles_select_self" on public.profiles;
drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_select_self" on public.profiles
  for select to authenticated using (user_id = auth.uid());
create policy "profiles_update_self" on public.profiles
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table public.user_roles enable row level security;
drop policy if exists "user_roles_select_self" on public.user_roles;
create policy "user_roles_select_self" on public.user_roles
  for select to authenticated using (user_id = auth.uid());

alter table public.workspaces enable row level security;
drop policy if exists "workspaces_select_member" on public.workspaces;
drop policy if exists "workspaces_update_admin" on public.workspaces;
create policy "workspaces_select_member" on public.workspaces
  for select to authenticated using (public.is_workspace_member(id, auth.uid()));
create policy "workspaces_update_admin" on public.workspaces
  for update to authenticated using (public.is_workspace_admin(id, auth.uid()));

alter table public.workspace_members enable row level security;
drop policy if exists "wm_select_member" on public.workspace_members;
drop policy if exists "wm_write_admin" on public.workspace_members;
create policy "wm_select_member" on public.workspace_members
  for select to authenticated using (public.is_workspace_member(workspace_id, auth.uid()));
create policy "wm_write_admin" on public.workspace_members
  for all to authenticated
  using (public.is_workspace_admin(workspace_id, auth.uid()))
  with check (public.is_workspace_admin(workspace_id, auth.uid()));

-- ---------------------------------------------------------------------------
-- 4. A view do fluxo herda a RLS das tabelas base
-- ---------------------------------------------------------------------------
alter view public.v_flow_pipeline set (security_invoker = on);
grant select on public.v_flow_pipeline to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Execução das RPCs: só usuário autenticado, nunca anônimo
-- ---------------------------------------------------------------------------
do $$
declare f text;
begin
  foreach f in array array[
    'flow_upsert_company','flow_upsert_contact','flow_enroll_followup',
    'flow_enqueue_send','flow_ensure_conversation','crm_ensure_deal',
    'crm_move_deal','contact_block','lead_enrich_apply','flow_record_event'
  ]
  loop
    execute format('revoke all on function public.%I from public, anon', f);
    execute format('grant execute on function public.%I to authenticated, service_role', f);
  end loop;

  -- borda: só a edge function (service_role) ingere webhook e mensagem
  foreach f in array array['flow_ingest_inbound','webhook_claim'] loop
    execute format('revoke all on function public.%I from public, anon, authenticated', f);
    execute format('grant execute on function public.%I to service_role', f);
  end loop;
end $$;
