# CUTOVER — [VIA] Motor Comercial

Roteiro de virada da chave. Cada passo tem **o que fazer**, **como verificar** e
**como reverter**. Passo sem verificação declarada não é passo, é esperança.

A ordem não é sugestão: cada passo depende do anterior estar verificado. Rodar o
passo 5 com o passo 2 não conferido é como ligar a esteira antes de saber se a
máquina está parafusada.

**Regra de reversão:** nenhum passo apaga dado do doador. Doador vira read-only e
é arquivado depois de um período combinado, nunca no mesmo dia.

---

## Passo 0 · Congelar e clonar

**Fazer**
- Doadores (`blank-canvas-project-29`, `whatsapp-flow-api-oficial-remix`) em
  read-only: revogar escrita no Supabase de cada um e avisar quem usa.
- Clonar o dado de produção de cada doador para o staging do produto.

**Verificar**
- `select count(*)` por tabela no doador == no staging.
- Nenhuma escrita nova no doador nas últimas 24h.

**Reverter** — devolver a permissão de escrita. Nada foi tocado no produto.

---

## Passo 1 · Espinha

**Fazer** — aplicar as migrations `20260908200001` a `20260908200007`.

**Verificar**
```bash
psql "$DATABASE_URL" -f provas/prova-fluxo-ponta-a-ponta.sql
# esperado: ERROR: PROVA_FLUXO {... as 15 asserções true ...}
```
E o retrato: 0 tabela de negócio sem `workspace_id`, 0 tabela com RLS ligada e
policy faltando fora do domínio máquina.

**Reverter** — restaurar o snapshot anterior do banco. As migrations são
reaplicáveis (`IF NOT EXISTS` / `CREATE OR REPLACE`), então reexecutar é seguro;
o que não é reversível sozinho é o `DROP` do trigger legado, que está no
snapshot.

**Estado:** ✅ feito e provado em 2026-09-08 (ver `PDCA.md`).

---

## Passo 2 · Canais

**Fazer**
- Migrar cada `whatsapp_instances` (doador A) e `meta_connections` (doador B)
  para uma linha em `channel_connections` + `channel_secrets`, com
  `provider` correto e `external_account_id` preenchido.
- Publicar `channel-connect` (conectar, parear, configurar, desconectar) e
  `channel-health` (cron de saúde por provider).
- Publicar `send-worker` e agendar a cada minuto.

**Verificar**
- Cada canal do doador tem uma linha correspondente, com `status = connected`.
- `send-worker` com a fila vazia devolve `{processed: 0}` sem erro.
- Enfileirar uma mensagem de teste para um número interno e conferir que ela
  chega **uma vez** e que `send_queue.provider_message_id` foi preenchido.

**Reverter** — desagendar o `send-worker`. A fila acumula em `pending` sem
enviar nada; nenhuma mensagem se perde.

**Segredos necessários (nascem aqui):** `META_VERIFY_TOKEN`, `ZERNIO_API_KEY`,
e por canal Evolution: `base_url`, `api_key`, `instance_name` em
`channel_secrets.extra`.

---

## Passo 3 · Prospecção

**Fazer**
- Publicar `lead-search-execute`, `lead-enrich-ai`, `scraping-execute`,
  `test-apollo-connection`.
- Carregar `lead_companies` e `contacts` do doador A com `legacy_source='A'` e
  `legacy_id` = id de origem.
- Segredo: `APOLLO_API_KEY`.

**Verificar**
- `test-apollo-connection` devolve 200.
- Rodar a **mesma** busca duas vezes: a segunda não cria contato novo
  (`contacts_new = 0`) — é a prova de que a carga é reentrante.
- `select count(*) from contacts where phone_e164 is null` == 0 para o que veio
  com telefone.

**Reverter** — `delete from contacts where legacy_source='A'` (e idem
`lead_companies`). O `legacy_id` existe exatamente para tornar a carga
reversível sem tocar no que já era do produto.

---

## Passo 4 · Templates e canal oficial

**Fazer**
- Publicar `submit-template`, `sync-template-status`.
- Migrar `meta_templates` do doador B, amarrando ao `channel_id` novo.
- Publicar `meta-webhook` e apontar o webhook da Meta para a URL nova.

**Verificar**
- `sync-template-status` traz o status real dos templates aprovados.
- Mandar uma mensagem para o número oficial e conferir no banco:
  1 linha em `webhook_events`, 1 em `messages`, e a conversa aberta.
- Reenviar o **mesmo** evento (a Meta reentrega quando demora): continua
  1 mensagem, e o webhook responde `duplicadas: 1`.

**Reverter** — apontar o webhook de volta para o doador B. O produto para de
receber, o doador volta a receber; nenhuma mensagem se perde no meio porque a
Meta reentrega o que não teve 200.

---

## Passo 5 · Cadência, campanha e fluxos

**Fazer**
- Publicar `followup-enroller`, `followup-processor`, `broadcast-processor`,
  `flow-executor`, `check-flow-timeouts`.
- Agendar: `followup-processor` a cada 5 min, `broadcast-processor` a cada 2 min,
  `check-flow-timeouts` a cada 10 min.
- Carregar `followup_sequences` / `_steps` do doador A (as **inscrições** não:
  cadência em andamento no doador termina lá).

**Verificar**
- Inscrever um contato de teste, deixar o passo 1 sair, **responder** pelo
  WhatsApp e conferir que a inscrição foi para `stopped` com
  `stop_reason = 'resposta_do_lead'` e que a fila daquele contato foi cancelada.
- Rodar `followup-processor` duas vezes seguidas: o mesmo passo não sai duas
  vezes (`uq_followup_logs_envio_unico`).

**Reverter** — desagendar os três crons. Cadência congela onde está;
`next_send_at` continua no passado e retoma quando reagendar.

---

## Passo 6 · Métricas

**Fazer** — publicar `campaign-ai-analysis`, `ai-column-mapper`,
`generate-message-variations`.

**Verificar** — a análise de uma campanha encerrada bate com a contagem em
`broadcast_recipients`.

**Reverter** — despublicar. Nada depende delas para operar.

---

## Passo 7 · Telas

**Fazer** — publicar os módulos de front, na ordem em que o fluxo acontece:
`prospeccao` → `cadencia` → `campanhas` → `canais` → `fluxos`, e a coluna de
etapa do fluxo (`v_flow_pipeline`) no Dashboard.

**Verificar**
- Cada capacidade trazida do doador tem rota e lugar no menu — a lista está no
  `merge/mapa-destinos.json`, e o gate confere.
- E2E com dado real: prospectar 1 empresa → achar decisor → inscrever em
  cadência → receber resposta → ver a oportunidade aparecer no funil, sem tocar
  no banco à mão em nenhum momento.
- `npm run build` verde e `node scripts/cobertura.mjs` verde.

**Reverter** — cada módulo é uma rota; remover a rota tira a tela sem afetar o
banco.

---

## Passo 8 · Baseline e arquivamento

**Fazer**
- Registrar o baseline exato: contagem por tabela, `provider_message_id`
  distintos, deals por estágio.
- Limpar a carga tagueada de teste: `delete ... where legacy_source like 'TESTE%'`.
- Doadores arquivados (não apagados) após 30 dias de produto no ar.

**Verificar**
- `select count(*) from contacts where legacy_source like 'TESTE%'` == 0.
- Uma semana sem `send_queue` acumulando em `failed` por erro de configuração.

**Reverter** — o arquivamento é o único passo sem volta rápida, e por isso é o
último e tem 30 dias de espera. Até lá, os doadores seguem íntegros em
read-only.

---

## Checklist de saída

- [ ] Prova transacional verde no banco de produção
- [ ] Prova de permissão por perfil verde
- [ ] Gate de cobertura verde (`node scripts/cobertura.mjs`)
- [ ] Todo canal do doador com correspondente conectado
- [ ] Carga conferida por contagem e checksum, e reentrante
- [ ] Toda capacidade do doador com rota e lugar no menu
- [ ] E2E com dado real, ponta a ponta, sem toque manual no banco
- [ ] Baseline registrado e carga de teste limpa
- [ ] PDCA do ciclo escrito
