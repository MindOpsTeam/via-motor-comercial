-- ============================================================================
-- PROVA TRANSACIONAL — fluxo ponta a ponta, idempotência e fronteira
-- ----------------------------------------------------------------------------
-- A lei da confluência: nada é declarado pronto sem prova executada no banco
-- real, com rollback, e a evidência colada no diário.
--
-- Este bloco cria dado temporário, exercita o fluxo pelas MESMAS portas que a
-- aplicação usa (as RPCs), confere as invariantes e termina em RAISE EXCEPTION
-- para o banco desfazer tudo. O texto do erro é o resultado.
--
-- Como rodar:  psql ... -f provas/prova-fluxo-ponta-a-ponta.sql
-- Esperado:    ERROR: PROVA_FLUXO {...todas as asserções true...}
-- ============================================================================
do $$
declare
  ws uuid; emp1 uuid; emp2 uuid; ct1 uuid; ct2 uuid; ct3 uuid;
  seq uuid; enr1 uuid; enr2 uuid; snd1 uuid; snd2 uuid;
  in1 jsonb; in2 jsonb; deal uuid; est2 uuid; wh1 boolean; wh2 boolean;
  n_emp int; n_ct int; n_enr_tot int; n_enr_ativ int; n_snd int; n_msg int;
  n_ativ int; n_deal int; q_canc int; etapa text; n_jornada int;
  ws2 uuid; ct_outro uuid; vaz int; r jsonb;
begin
  insert into public.workspaces (name, slug, status)
    values ('PROVA', 'prova-'||gen_random_uuid(), 'active') returning id into ws;
  insert into public.pipeline_stages (workspace_id,title,color,position,is_active) values (ws,'Novo','#111',1,true);
  insert into public.pipeline_stages (workspace_id,title,color,position,is_active) values (ws,'Qualificado','#222',2,true) returning id into est2;

  -- A. EMPRESA: duas chamadas, mesmo domínio em caixas diferentes -> uma empresa
  emp1 := public.flow_upsert_company(ws,'Acme Ltda','acme.com.br',null,'{"industry":"Software"}');
  emp2 := public.flow_upsert_company(ws,'ACME LTDA','ACME.COM.BR',null,'{"employees_count":"50"}');
  select count(*) into n_emp from public.lead_companies where workspace_id=ws;

  -- B. DECISOR: o mesmo telefone em três formatos -> um contato
  ct1 := public.flow_upsert_contact(ws,'Joana Prado','+55 (11) 91234-5678','joana@acme.com.br',emp1,'Diretora',true,'apollo');
  ct2 := public.flow_upsert_contact(ws,'Joana P.','5511912345678');
  ct3 := public.flow_upsert_contact(ws,'Joana','011912345678');
  select count(*) into n_ct from public.contacts where workspace_id=ws;

  -- C. ENRIQUECIMENTO pela porta com autoridade sobre o score
  perform public.lead_enrich_apply(ct1, 87.5, '{"role_title":"Diretora de Operações"}');

  -- D. CADÊNCIA: inscrever duas vezes -> uma inscrição viva
  insert into public.followup_sequences (workspace_id,name,status,on_reply_behavior)
    values (ws,'Cadência SDR','active','stop') returning id into seq;
  insert into public.followup_steps (workspace_id,sequence_id,position,content) values (ws,seq,1,'Oi {{nome}}');
  enr1 := public.flow_enroll_followup(seq, ct1);
  enr2 := public.flow_enroll_followup(seq, ct1);
  select count(*) into n_enr_tot from public.followup_enrollments where workspace_id=ws;

  -- E. ENVIO: mesma dedupe_key duas vezes -> uma linha na fila
  snd1 := public.flow_enqueue_send(ws, ct1, 'Oi Joana', 'followup', 'fu:'||enr1::text||':1', enr1);
  snd2 := public.flow_enqueue_send(ws, ct1, 'Oi Joana', 'followup', 'fu:'||enr1::text||':1', enr1);
  select count(*) into n_snd from public.send_queue where workspace_id=ws;

  -- F. INBOUND: o mesmo provider_message_id duas vezes -> uma mensagem
  in1 := public.flow_ingest_inbound(ws,'meta','wamid.XYZ','+5511912345678','Tenho interesse');
  in2 := public.flow_ingest_inbound(ws,'meta','wamid.XYZ','+5511912345678','Tenho interesse');
  select count(*) into n_msg from public.messages where workspace_id=ws;

  -- G. CONCATENAÇÃO: a resposta parou a cadência e cancelou o envio pendente
  select count(*) into n_enr_ativ from public.followup_enrollments where workspace_id=ws and status='active';
  select count(*) into q_canc from public.send_queue where workspace_id=ws and status='failed';

  -- H. CRM: virou oportunidade sozinho, e só uma
  deal := (in1->>'deal_id')::uuid;
  select count(*) into n_deal from public.deals where workspace_id=ws;
  perform public.crm_move_deal(deal, est2, 'respondeu');
  perform public.crm_move_deal(deal, est2, 'de novo');   -- mover para onde já está não duplica
  select count(*) into n_ativ from public.deal_activities where workspace_id=ws;

  -- I. WEBHOOK: primeira vez processa, segunda não
  wh1 := public.webhook_claim(ws,'meta','evt-1','message','{}');
  wh2 := public.webhook_claim(ws,'meta','evt-1','message','{}');

  -- J. O FLUXO VISTO COMO UM INTEIRO
  select etapa_atual into etapa from public.v_flow_pipeline where contact_id=ct1;
  select count(*) into n_jornada from public.journey_events where workspace_id=ws;

  -- K. FRONTEIRA: o mesmo telefone em outro workspace é outro contato
  insert into public.workspaces (name,slug,status) values ('PROVA2','prova2-'||gen_random_uuid(),'active') returning id into ws2;
  ct_outro := public.flow_upsert_contact(ws2,'Outra Joana','+5511912345678');
  select count(*) into vaz from public.v_flow_pipeline where workspace_id=ws2 and contact_id=ct1;

  r := jsonb_build_object(
    'A_empresa_idempotente',           (n_emp=1 and emp1=emp2),
    'B_contato_3_formatos_1_registro', (n_ct=1 and ct1=ct2 and ct2=ct3),
    'C_inscricao_unica',               (n_enr_tot=1 and enr1=enr2),
    'D_envio_dedupe',                  (n_snd=1 and snd1=snd2),
    'E_inbound_idempotente',           (n_msg=1 and (in1->>'duplicada')='false' and (in2->>'duplicada')='true'),
    'F_resposta_matou_cadencia',       (n_enr_ativ=0 and (in1->>'cadencias_paradas')='1'),
    'G_envio_pendente_cancelado',      (q_canc=1 and (in1->>'envios_cancelados')='1'),
    'H_deal_automatico_e_unico',       (n_deal=1 and deal is not null),
    'I_move_sem_atividade_duplicada',  (n_ativ=1),
    'J_webhook_dedupe',                (wh1 and not wh2),
    'K_inbound_reconheceu_o_contato',  ((in1->>'contact_id')::uuid = ct1),
    'L_etapa_no_fluxo',                etapa,
    'M_fronteira_entre_workspaces',    (ct_outro <> ct1 and vaz = 0),
    'medidas', jsonb_build_object('empresas',n_emp,'contatos',n_ct,'fila',n_snd,'mensagens',n_msg,
      'cadencias_ativas',n_enr_ativ,'cancelados',q_canc,'deals',n_deal,'atividades',n_ativ,
      'eventos_jornada',n_jornada));

  raise exception 'PROVA_FLUXO %', r::text;
end $$;
