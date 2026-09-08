-- ============================================================================
-- PROVA TRANSACIONAL — o contrato entre as edge functions e a espinha
-- ----------------------------------------------------------------------------
-- A prova do fluxo (prova-fluxo-ponta-a-ponta.sql) mostra que as RPCs fazem o
-- que prometem. Esta mostra outra coisa: que as edge functions portadas usam
-- exatamente essas portas, com as chaves de idempotência que elas declaram.
--
-- Cada asserção espelha uma chamada real de `supabase/functions/_shared/flow.ts`:
--   B  followup-processor  -> enqueueSend com 'followup:<inscricao>:<passo>'
--   C  meta-webhook        -> claimWebhook
--   D..G meta-webhook      -> ingestInbound
--   H  send-worker         -> claim_send_queue_batch
--
-- Como rodar:  psql ... -f provas/prova-porte-edge-functions.sql
-- Esperado:    ERROR: PROVA_PORTE {... as 8 asserções true ...}
-- ============================================================================
do $$
declare
  ws uuid; ct uuid; seq uuid; enr uuid; f1 uuid; f2 uuid;
  in1 jsonb; wk boolean; lote int;
  n_fila int; n_msg int; n_ativas int; n_canc int; r jsonb;
begin
  insert into public.workspaces (name,slug,status) values ('PROVA-PORTE','pp-'||gen_random_uuid(),'active') returning id into ws;
  insert into public.pipeline_stages (workspace_id,title,color,position,is_active) values (ws,'Novo','#111',1,true);

  ct := public.flow_upsert_contact(ws,'Teste Porte','+5511977776666');
  insert into public.followup_sequences (workspace_id,name,status,on_reply_behavior)
    values (ws,'Cadência','active','stop') returning id into seq;
  insert into public.followup_steps (workspace_id,sequence_id,position,content) values (ws,seq,1,'Oi {{nome}}');
  enr := public.flow_enroll_followup(seq, ct);

  -- followup-processor: a chave é inscrição+passo. Reprocessar o mesmo passo
  -- (retry do cron, duas execuções concorrentes) não manda a mensagem de novo.
  f1 := public.flow_enqueue_send(ws, ct, 'Oi', 'followup', 'followup:'||enr::text||':1', enr);
  f2 := public.flow_enqueue_send(ws, ct, 'Oi', 'followup', 'followup:'||enr::text||':1', enr);
  select count(*) into n_fila from public.send_queue where workspace_id=ws;

  -- meta-webhook: reivindica o evento e entrega para o nó de concatenação.
  wk := public.webhook_claim(ws,'meta','wamid.PORTE','message:text','{}');
  in1 := public.flow_ingest_inbound(ws,'meta','wamid.PORTE','+5511977776666','oi');
  select count(*) into n_msg from public.messages where workspace_id=ws;
  select count(*) into n_ativas from public.followup_enrollments where workspace_id=ws and status='active';
  select count(*) into n_canc from public.send_queue where workspace_id=ws and status='failed';

  -- send-worker: o lote não traz o envio que o inbound acabou de cancelar.
  select count(*) into lote from public.claim_send_queue_batch(10);

  r := jsonb_build_object(
    'A_contrato_das_edges_responde', (ct is not null and enr is not null),
    'B_followup_enfileira_uma_vez',  (n_fila=1 and f1=f2),
    'C_webhook_claim_primeira_vez',  wk,
    'D_inbound_gravou_uma_mensagem', (n_msg=1),
    'E_inbound_parou_a_cadencia',    (n_ativas=0),
    'F_inbound_abriu_oportunidade',  ((in1->>'deal_id') is not null),
    'G_envio_pendente_cancelado',    (n_canc=1 and (in1->>'envios_cancelados')='1'),
    'H_worker_nao_pega_cancelado',   (lote=0));

  raise exception 'PROVA_PORTE %', r::text;
end $$;
