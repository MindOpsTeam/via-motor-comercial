-- ============================================================================
-- Confluência · Fase 4 · Bloco 6 — Vocabulário de atividade do CRM
-- ----------------------------------------------------------------------------
-- Achado da prova transacional: `deal_activities.type` só aceitava os cinco
-- tipos que um humano registra à mão —
--   note, call, email, meeting, task
-- — e não tinha vocabulário para o que o sistema registra sozinho.
--
-- Isso quebrava crm_move_deal(), que grava a movimentação de estágio como
-- atividade no mesmo bloco transacional da mudança. Sem isso o funil anda sem
-- deixar rastro, que é o defeito que o histórico de atividade existe para
-- resolver.
--
-- O vocabulário passa a ter dois lados declarados: o que a pessoa faz e o que
-- o fluxo faz por ela.
-- ============================================================================

alter table public.deal_activities drop constraint if exists deal_activities_type_check;

alter table public.deal_activities add constraint deal_activities_type_check
  check (type = any (array[
    -- registrados por uma pessoa
    'note','call','email','meeting','task',
    -- registrados pelo fluxo, pela porta única correspondente
    'stage_change',   -- crm_move_deal()
    'won','lost',     -- fechamento
    'inbound',        -- flow_ingest_inbound(): o lead respondeu
    'followup_sent',  -- disparo de cadência
    'system'          -- qualquer outro registro automático
  ]));

comment on constraint deal_activities_type_check on public.deal_activities is
  'Vocabulário fechado de atividade. Ampliar aqui, nunca gravar tipo livre.';
