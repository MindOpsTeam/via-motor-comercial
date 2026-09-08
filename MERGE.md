# MERGE — [VIA] Motor Comercial

Decisões da fusão, versionadas. Este arquivo é a resposta quando alguém perguntar
"o que aconteceu com X?".

**Método:** skill `confluencia` — fusão B (extração): um trunk hospedeiro, um banco,
uma espinha.

| | |
|---|---|
| **Trunk** | `MindOpsTeam/remix-of-nina-zernio-original` |
| **Doador A** | `MindOpsTeam/blank-canvas-project-29` — prospecção e cadência |
| **Doador B** | `MindOpsTeam/whatsapp-flow-api-oficial-remix` — Meta oficial, listas N:N, campanha |
| **Produto** | `MindOpsTeam/via-motor-comercial` · Lovable `8f173410-ddf6-49f9-b7ca-544d82a9f27d` |

**Por que o trunk é o Nina Zernio:** é o mais vivo, o mais caro de recriar (42 tabelas,
33 RPCs, 11 enums, o motor de agente/RAG/eval) e o único com fronteira de permissão real.
Os doadores viram read-only no cutover e são arquivados depois de um período combinado,
nunca apagados no mesmo dia.

---

## O fluxo, que é a razão da fusão

```
busca → EMPRESA → DECISOR → lista → CADÊNCIA → envio → CONVERSA → DEAL → fechamento
```

Cada seta é uma FK real e cada transição tem uma RPC dona. Onde a seta não existisse, o
operador teria que reconciliar na mão — que é exatamente o que os três sistemas separados
obrigavam a fazer.

---

## Matriz 1 — Colisão de nomes

| Nome | A | B | Trunk | Decisão | Estado |
|---|:-:|:-:|:-:|---|---|
| `contacts` | ✓ | ✓ | ✓ | fundido no modelo do trunk + campos de prospecção. `phone`/`phone_number` → **`phone_e164`**, mantida por trigger | ✅ |
| `deals` | ✓ | ✓ | ✓ | trunk vence (FK `contact_id`). As colunas denormalizadas do doador A (`contact_name`, `contact_email`, `contact_phone`, `owner_name`) **morreram** | ✅ |
| `pipeline_stages` | ✓ | ✓ | ✓ | fundido; `user_id` → `workspace_id`; unique `(workspace_id, position)` | ✅ |
| `deal_activities` | ✓ | ✓ | ✓ | trunk vence (tem `created_by` e `scheduled_at`); vocabulário de `type` ampliado | ✅ |
| `conversation_messages` | ✓ | ✓ | — | **morreu**. O modelo é `conversations` + `messages` | ✅ |
| `contact_lists` | ✓ | ✓ | — | doador B vence (N:N via `contact_list_members`); o `list_id` 1:N do doador A morreu | ✅ |
| `whatsapp_instances` / `meta_connections` / `channel_connections` | ✓ | ✓ | ✓ | **uma tabela**: `channel_connections` com `provider ∈ {zernio, meta, evolution}` + `channel_secrets` para credencial | ✅ |
| `message_templates` | ✓ | ✓ | — | renomeado **`message_snippets`** (texto livre), para não confundir com `meta_templates` (HSM aprovado pela Meta) | ✅ |
| `app_settings` / `nina_settings` | ✓ | ✓ | ✓ | trunk vence; chave única migrada de `user_id` para `workspace_id` | ✅ |
| `webhook_message_dedup` / `zernio_webhook_events` | ✓ | ✓ | ✓ | **`webhook_events`**, um por provedor, unique `(workspace_id, provider, provider_event_id)` | ✅ |
| `is_blacklisted` vs `is_blocked` | ✓ | ✓ | ✓ | sobrou **um**: `is_blocked` + `blocked_reason`. A blacklist de campanha lê dali | ✅ |
| `profiles`, `user_roles`, `has_role()` | ✓ | — | ✓ | trunk vence. Dois níveis: papel global (`app_role`) e papel no workspace (`workspace_member_role`) | ✅ |
| `flows`, `flow_nodes`, `flow_edges`, `flow_executions` | ✓ | ✓ | — | doador B vence (mais recente) | ⏳ ciclo 2 |
| `broadcast_campaigns` / `broadcast_recipients` | ✓ | ✓ | — | doador B + rotação de mídia do doador A | ✅ |
| `voice_profiles`, `dispatch_profiles` | ✓ | ✓ | — | portados | ⏳ ciclo 2 |

**Sem colisão, portados inteiros:** `lead_companies`, `lead_searches`, `scraping_jobs`,
`followup_sequences/_steps/_enrollments/_logs` (doador A) · `meta_templates` (doador B) ·
todo o bloco de agente, conhecimento, eval, times, tags e agenda (trunk).

---

## Matriz 2 — Sobreposição funcional (uma implementação vence)

| Capacidade | Vencedor | Motivo |
|---|---|---|
| Tenancy e RLS | **trunk** | é o único que tinha. O doador A fechou em 11/08 com o commit "Fixed public access issues" — nenhuma policy dele foi reaproveitada |
| Auth e papéis | trunk | `workspace_members`, `is_workspace_admin()` |
| Inbox ao vivo | trunk | único com handoff `nina ↔ humano` |
| Motor agente / RAG / eval | trunk | não se reconstrói. **Protegido** |
| Prospecção e enriquecimento | doador A | único |
| Follow-up / cadência | doador A | único |
| Templates Meta (HSM) | doador B | único |
| Flow builder | doador B | mais recente, mesmo schema do A |
| Campanha / disparo | doador B + rotação do A | |
| **Envio de mensagem** | **nenhum — motor único novo** | três caminhos hoje (Evolution, Meta, Zernio); não se elege um. Unificados atrás de `send_queue` + adapter por provider |

---

## Matriz 3 — Autoridade de campo (um dono, imposto por RPC ou trigger)

| Coluna | Dono | Porta única |
|---|---|---|
| `contacts.phone_e164` | derivada | trigger `tg_contacts_normalize_phone` — nunca escrita à mão |
| `contacts.enrichment_score` | prospecção | `lead_enrich_apply()` |
| `contacts.lifecycle_status` | CRM | `crm_set_lifecycle()` ⏳ |
| `contacts.is_blocked` | bloqueio | `contact_block()` — para cadência e fila no mesmo bloco |
| `deals` (criação) | CRM | `crm_ensure_deal()` — **o trigger `auto_create_deal_on_contact` foi removido**, ver PDCA |
| `deals.stage_id` | CRM | `crm_move_deal()` — grava `deal_activities` na mesma transação |
| `conversations.status` | inbox | `inbox_take_over()` / `inbox_release()` ⏳ |
| `send_queue` (entrada) | qualquer origem | `flow_enqueue_send()` com `dedupe_key` obrigatória |
| `send_queue.status` | só o worker | `claim_send_queue_batch()` — nenhum front escreve |
| `followup_enrollments.status` | **cadência e inbox disputavam** | `flow_ingest_inbound()`: a resposta do lead para a cadência. Era a dupla escrita clássica deste merge |
| `messages` (entrada) | borda | `flow_ingest_inbound()`, idempotente por `provider_message_id` |
| `journey_events` | todas as etapas | `flow_record_event()`, idempotente por `dedupe_key` |

---

## Fronteira e overlap

- **Cadastro compartilhado:** `contacts` e `lead_companies` são de todos os módulos, sem
  restrição. Restringir contato a um módulo cegaria a venda do outro.
- **Documento de fronteira:** o `deal` (a prospecção origina, o CRM move, o inbox alimenta) e
  a `conversation` (a cadência dispara, o humano assume). Pertencem aos dois lados; quem pode
  o quê vive na RPC, não na tabela.
- **Motor único:** `send_queue`. Campanha, cadência, fluxo, inbox e agente **enfileiram**;
  nenhum caminho fala com provedor por fora.

---

## Domínios de permissão

| Domínio | Regra | Tabelas |
|---|---|---|
| **Negócio** | `is_workspace_member(workspace_id)` | 44 tabelas — fluxo, prospecção, cadência, campanha, canais, operação, motor de agente |
| **Máquina** | só `service_role`; `authenticated` não lê | filas (`send_queue`* , `*_processing_queue`, `message_grouping_queue`), `webhook_events`, `zernio_webhook_events`, `channel_secrets`, `calendar_oauth_states`, `agent_operation_rate_limits` |
| **Pessoal** | `auth.uid()` | `profiles`, `user_roles`, `workspaces`, `workspace_members` |

\* exceção deliberada: o operador **lê** a fila de envio do seu workspace para entender por
que uma mensagem não saiu. Escrita continua fechada.

---

## Estado

| Fase | Gate | Situação |
|---|---|---|
| 0 · Auditoria | três matrizes decididas | ✅ este arquivo |
| 1 · Trunk e fronteira | trunk decidido, repo conectado | ✅ |
| 2 · Espinha de dados | `workspace_id` em tudo; chaves naturais | ✅ 54 tabelas, 0 sem tenancy |
| 2b · Carga dos doadores | idempotente por `legacy_source`/`legacy_id` | ⏳ aguarda a fonte de produção |
| 3 · Código com história | gate de cobertura verde | ⏳ ciclo 2 |
| 4 · Regra de negócio | prova transacional verde | ✅ 13/13 — `provas/prova-fluxo-ponta-a-ponta.sql` |
| 5 · Permissão | prova de permissão por perfil | 🟡 190 policies aplicadas; prova com usuário real pendente |
| 6 · Interface e cutover | E2E com dado real | ⏳ |

Diário com a evidência de cada ciclo: [`PDCA.md`](PDCA.md).
