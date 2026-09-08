# Confluência — [VIA] Motor Comercial

**Data:** 2026-09-08
**Método:** skill `confluencia` (fusão B — extração, 1 banco, 1 espinha)
**Domínio:** Viver de IA (`~/code/mindops/`, git `guilherme.barboza@viverdeia.ai`)

---

## Goal

Um painel comercial único onde a mesma empresa atravessa o fluxo inteiro sem trocar de
sistema: **prospectar empresa → achar o decisor → cadenciar follow-up → CRM → inbox de chat
ao vivo com handoff humano**, com o motor de agente/RAG/eval por trás.

Hoje isso está partido em três apps, três bancos e três modelos de contato incompatíveis.

---

## Estado atual (auditoria read-only executada — fase 0)

Três repos clonados e lidos. Nada foi escrito em lugar nenhum.

| | `blank-canvas-project-29` | `whatsapp-flow-api-oficial-remix` | `remix-of-nina-zernio-original` |
|---|---|---|---|
| último commit | `a9c195c` 2026-08-11 "Fixed public access issues" | `fc6ccdf` 2026-09-01 | `7b2bf2c` 2026-09-08 |
| arquivos `src/` | 146 | 142 | 130 |
| migrations | 47 | 40 | 7 |
| edge functions | 23 | 11 | 25 |
| tabelas | 29 | 28 | 42 |
| RPCs | 3 | 1 | **33** |
| enums | 1 | 0 | **11** |
| **tenancy** | **nenhuma** | **nenhuma** | `workspaces` + `workspace_members` (parcial) |
| rotas | 19 | 11 | 13 |

### Capacidade exclusiva de cada um

**`blank-canvas-project-29` — é o único que prospecta.**
`lead_companies` (Apollo: `domain`, `employees_count`, `revenue`, `industry`, `linkedin_url`,
`ai_score`, `ai_summary`), `lead_searches`, `scraping_jobs`; edges `lead-search-ai-chat`,
`lead-search-execute`, `lead-enrich-ai`, `test-apollo-connection`, `scraping-execute`.
É também o único com **follow-up**: `followup_sequences` / `_steps` / `_enrollments` / `_logs`
(com `on_reply_behavior`, `send_window`, `ttl_days`, `ab_variants`) + 3 edges.

**`whatsapp-flow-api-oficial-remix` — é o único com WhatsApp oficial.**
`meta_connections` (`waba_id`, `phone_number_id`, `access_token`), `meta_templates` (HSM com
`components`, `status`, `validation_score`); edges `meta-webhook`, `send-meta-message`,
`submit-template`, `sync-template-status`. É a versão mais nova do flow builder e das
campanhas, e o único com `contact_list_members` (N:N correto).

**`remix-of-nina-zernio-original` — é o único com inbox, tenancy e motor de IA.**
`conversations` + `messages` + `conversation_states` + `send_queue` + handoff real
(`conversation_status: nina|human|paused`, `assigned_user_id`, `assigned_team`);
`workspaces` / `workspace_members` / `is_workspace_member()` / `current_workspace_id()`;
e o motor protegido: `agents`, `agent_versions`, `agent_drafts`, `knowledge_documents`,
`knowledge_chunks`, `knowledge_facts`, `search_knowledge()`, `prompt_versions`,
`golden_cases`, `eval_runs`, `eval_results`, `unanswered_questions`.

### Decisão de trunk

**Trunk = `remix-of-nina-zernio-original`.** É o mais vivo (editado hoje), o mais caro de
recriar (33 RPCs, 11 enums, motor de RAG/eval) e o único com fronteira de permissão real.
Os outros dois são **doadores** — viram read-only no cutover e são arquivados depois, nunca
apagados no mesmo dia.

### Suposições declaradas

1. A imagem anexada ao pedido chegou como placeholder HEIC sem conteúdo legível. O plano foi
   feito a partir do texto do briefing e da auditoria dos repos. Se a imagem tinha um layout
   de painel, ela reabre só a fase 6 (interface), não as anteriores.
2. O banco do projeto novo começa **vazio**. A carga do dado de produção dos três é a fase 2b,
   e só roda quando o Guilherme apontar qual instância é a fonte real de cada um.
3. "Projeto novo no Lovable" foi cumprido como **remix do trunk**, não canvas em branco —
   ver justificativa em "O que já foi feito".

---

## O que já foi feito nesta sessão

| | |
|---|---|
| Projeto Lovable | **[VIA] Motor Comercial** |
| ID | `8f173410-ddf6-49f9-b7ca-544d82a9f27d` |
| Workspace | VIVER DE IA Team Workspace (`4CscjTfdP3u4Xba0i5P3`) |
| Editor | https://lovable.dev/projects/8f173410-ddf6-49f9-b7ca-544d82a9f27d |
| Preview | https://id-preview--8f173410-ddf6-49f9-b7ca-544d82a9f27d.lovable.app |
| Commit inicial | `c6f2694` |
| Knowledge | gravado (agente Lovable = executor, invariantes travados) |

**Por que remix e não canvas em branco.** Canvas em branco descarta as 42 tabelas, 33 RPCs e
11 enums do trunk e obriga a reescrever o motor de agente/RAG/eval do zero — semanas de
trabalho para chegar num lugar pior. O remix é um projeto Lovable **novo** (id novo, banco
novo, preview nova, história zerada) que já nasce com a espinha que a confluência elegeu como
trunk. É a leitura que entrega o pedido sem jogar fora o ativo.

O knowledge do projeto já trava o agente do Lovable no papel de executor: ele não cria tabela,
não escreve migration, não conserta RLS e não inventa tela. Autoria é minha, via commit.

---

## Bloqueio a levantar (não é desculpa, é dependência externa)

O projeto novo **ainda não tem repo GitHub conectado**. O fluxo git-first — eu escrevo,
commito, e o Lovable só aplica o commit — depende disso. A conexão GitHub é feita na UI pelo
dono do workspace e não é exposta pelo MCP oficial.

**Ação:** conectar `[VIA] Motor Comercial` a um repo `MindOpsTeam/via-motor-comercial` pelo
botão GitHub do editor. Enquanto isso não existe, o trabalho segue: as migrations e o código
das fases 2–4 são escritos localmente em
`~/code/mindops/solucoes/via-motor-comercial/` e ficam prontos para o primeiro push.

---

## As três matrizes (fase 0)

### Matriz 1 — Colisão de nomes

| Nome | BC | WA | NINA | Decisão |
|---|:-:|:-:|:-:|---|
| `contacts` | ✓ | ✓ | ✓ | **fundir** no modelo NINA + campos de prospecção do BC. `phone`(BC/WA) e `phone_number`(NINA) → coluna canônica **`phone_e164`** |
| `deals` | ✓ | ✓ | ✓ | **fundir** no modelo NINA (FK `contact_id`). As colunas denormalizadas do BC (`contact_name`, `contact_email`, `contact_phone`, `owner_name`) **morrem** — viram FK |
| `pipeline_stages` | ✓ | ✓ | ✓ | fundir (NINA); `user_id` → `workspace_id` |
| `deal_activities` | ✓ | ✓ | ✓ | fundir (NINA — tem `created_by` e `scheduled_at` que os outros não têm) |
| `conversation_messages` | ✓ | ✓ | — | **morre**. Dado migra para `conversations` + `messages` do trunk |
| `contact_lists` | ✓ | ✓ | — | fundir; **WA vence** (tem `contact_list_members` N:N). `contacts.list_id` do BC vira linha em `contact_list_members` |
| `whatsapp_instances` | ✓ | ✓ | — | + `meta_connections`(WA) + `channel_connections`(NINA) → **uma tabela `channels`** com `provider ∈ {evolution, meta, zernio}` |
| `flows` `flow_nodes` `flow_edges` `flow_executions` `flow_execution_logs` | ✓ | ✓ | — | **WA vence** (mais recente). BC morre |
| `broadcast_campaigns` `broadcast_recipients` | ✓ | ✓ | — | WA vence + BC doa `media_rotation_mode`, `rotation_strategy`, `variation_indices` |
| `message_templates` | ✓ | ✓ | — | portado. **Não confundir com `meta_templates`**: um é texto livre, outro é HSM aprovado pela Meta. Renomear para **`message_snippets`** para matar a ambiguidade |
| `app_settings` | ✓ | ✓ | — | fundir com `nina_settings` → **`workspace_settings`** (chave/valor por workspace) |
| `voice_profiles` / `dispatch_profiles` | ✓ | ✓ | — | portados (BC e WA idênticos) |
| `profiles` | ✓ | — | ✓ | NINA vence |
| `user_roles` | ✓ | — | ✓ | NINA + `workspace_members`: **dois níveis** — papel global (`app_role`) e papel no workspace (`workspace_member_role`) |
| `webhook_message_dedup` | ✓ | ✓ | — | fundir com `zernio_webhook_events` → **`webhook_events`** com unique por `(provider, provider_event_id)` |
| `has_role()` | ✓ | — | ✓ | NINA |
| `upsert_lead_contact()` | ✓ | ✓ | — | reescrita: passa a resolver por `(workspace_id, phone_e164)` |
| enum `app_role` | ✓ | — | ✓ | NINA |

**Sem colisão (portados inteiros):** `lead_companies`, `lead_searches`, `scraping_jobs`,
`followup_*` (BC) · `meta_connections`, `meta_templates` (WA) · todo o bloco de agente,
conhecimento, eval, times, tags e agenda (NINA).

### Matriz 2 — Sobreposição funcional (uma implementação vence)

| Capacidade | Vencedor | Motivo |
|---|---|---|
| Tenancy e RLS | **NINA** | é o único que tem. BC fechou 2026-08-11 com "Fixed public access issues" — auditar antes de reaproveitar qualquer padrão dele |
| Auth e papéis | NINA | `workspace_members`, `is_workspace_admin()` |
| Inbox ao vivo | NINA | único com handoff `nina ↔ human` e contexto preservado |
| Motor agente / RAG / eval | NINA | não se reconstrói. **Protegido** |
| Flow builder | WA | mais recente, mesmo schema do BC |
| Campanha / disparo | WA + rotação do BC | |
| Templates Meta (HSM) | WA | único |
| Follow-up / cadência | BC | único |
| Prospecção e enriquecimento | BC | único |
| **Envio de mensagem** | **nenhum — motor único novo** | três caminhos hoje (Evolution, Meta, Zernio). Não se escolhe um: unificam-se atrás de `send_queue` + adapter por provider |
| Design system (shadcn) | trunk | os três são o mesmo |

### Matriz 3 — Autoridade de campo (um dono por coluna, imposto por RPC/trigger)

| Coluna | Quem escreve | Porta única |
|---|---|---|
| `contacts.lifecycle_status` | CRM | `crm_set_contact_stage()` |
| `contacts.enrichment_score` | prospecção | `lead_enrich_apply()` |
| `contacts.tags[]` | ambos | `contact_add_tag()` / `contact_remove_tag()` — array nunca escrito direto |
| `contacts.is_blocked` | **colisão de nome**: BC `is_blacklisted` vs NINA `is_blocked` — sobra **um**: `is_blocked` + `blocked_reason`. A blacklist de campanha passa a ler dali | `contact_block()` |
| `deals.stage_id` | CRM | `crm_move_deal()` (grava `deal_activities` no mesmo bloco) |
| `conversations.status` | inbox | `inbox_take_over()` / `inbox_release()` |
| `send_queue.status` | só o worker | `claim_send_queue_batch()` — nenhum front escreve |
| `followup_enrollments.status` | **cadência e inbox disputam** | trigger em `messages` inbound → `followup_on_inbound(contact_id)`. **A resposta do lead mata a cadência.** É a dupla-escrita clássica deste merge |

### Fronteira e overlap

- **Cadastro compartilhado:** `contacts`, `lead_companies` — compartilhados, sem restrição por
  módulo. Restringir contato a um módulo cegaria a venda do outro.
- **Documento de fronteira:** o `deal` (a prospecção cria, o CRM move, o inbox alimenta) e a
  `conversation` (a cadência dispara, o humano assume). Pertencem aos dois lados; a regra de
  quem pode o quê vive na RPC, não na tabela.
- **Motor único:** `send_queue`. Campanha, follow-up, fluxo e inbox **enfileiram**; nenhum
  caminho fala com provedor por fora.

---

## Espinha de dados (fase 2)

**Tenancy.** O trunk é inconsistente consigo mesmo: `agents`, `agent_versions`, `knowledge_*`
e `appointments` usam `workspace_id`; `contacts`, `deals`, `pipeline_stages`, `conversations`,
`teams`, `tag_definitions` usam `user_id`. Os doadores não têm coluna nenhuma. **Unificar em
`workspace_id NOT NULL` em toda tabela de negócio** é a mudança estrutural mais arriscada e a
primeira a ser provada.

**Identidade de contato.** Chave natural `(workspace_id, phone_e164)`, com índice único.
Função `normalize_phone_br(text) → e164` aplicada na carga e na RPC de upsert.

**Colisão de UUID entre bancos.** Os três bancos são independentes; IDs podem coincidir.
Toda tabela carregada ganha `legacy_source` + `legacy_id` com unique `(legacy_source, legacy_id)`
e PK nova. É o que torna a carga **idempotente**: rodar duas vezes não duplica.

---

## Plano por fase

| # | Fase | Entrega | Gate de saída |
|---|---|---|---|
| 0 | Auditoria | ✅ **feita** — 3 matrizes acima | `MERGE.md` versionado com as matrizes |
| 1 | Trunk e fronteira | ✅ trunk decidido, projeto novo criado | repo GitHub conectado; doadores congelados |
| 2 | Espinha de dados | `workspace_id` em tudo; `contacts` unificado; `channels`; `webhook_events`; `workspace_settings` | contagem e checksum origem == destino; órfãos = 0 |
| 2b | Carga | carga idempotente por `legacy_source`/`legacy_id` | repetir a carga não duplica |
| 3 | Código com história | um PR por doador; módulos em `src/modules/*` | gate de cobertura verde |
| 4 | Regra de negócio | RPCs como porta única + guardas + idempotência | prova transacional 100% verde |
| 5 | Permissão | RLS por domínio gerada, não escrita à mão | prova de permissão por perfil, verde |
| 6 | Interface e cutover | telas + roteiro com reversão + PDCA | E2E com dado real |

### Fase 3 — layout de módulos (trava do Lovable)

O Lovable espera o app na raiz do repo. **`apps/*` quebra o sync.** Módulos na raiz:

```
src/modules/prospeccao/    empresas, decisores, buscas, enriquecimento   (← BC)
src/modules/cadencia/      sequências, passos, inscrições, janelas       (← BC)
src/modules/crm/           funil, deals, atividades                      (← NINA + BC/WA)
src/modules/inbox/         conversas, mensagens, handoff                 (← NINA)
src/modules/canais/        evolution | meta | zernio, templates HSM      (← WA + BC + NINA)
src/modules/campanhas/     disparo, listas, rotação de mídia             (← WA + BC)
src/modules/fluxos/        flow builder                                  (← WA)
src/modules/agente/        agentes, versões, conhecimento, eval  PROTEGIDO (← NINA)
```

### Fase 4 — provas transacionais obrigatórias

Cada uma é um bloco `DO` que exercita pela RPC oficial e termina em
`RAISE EXCEPTION 'PROVA_X {json}'` — o banco desfaz tudo e a evidência sai no texto do erro.

| Arquivo | O que prova |
|---|---|
| `prova-espinha.sql` | contagem/checksum origem == destino; zero órfão |
| `prova-contato-unico.sql` | mesmo telefone vindo de duas origens vira **um** contato; recarga não duplica |
| `prova-deal-fk.sql` | nenhum deal sem `contact_id` válido; nenhum campo denormalizado sobrevivente |
| `prova-envio-porta-unica.sql` | campanha, follow-up, fluxo e inbox enfileiram em `send_queue`; nenhum provider chamado por fora |
| `prova-idempotencia-webhook.sql` | mesmo `provider_event_id` duas vezes = uma mensagem |
| `prova-cadencia-para-na-resposta.sql` | inbound do lead encerra o `followup_enrollment` |
| `prova-handoff.sql` | `nina → human → nina` preserva contexto e não perde mensagem |
| `prova-permissao.sql` | membro do workspace A não lê nada do B, tabela por tabela |

---

## Arquivos que devem existir ao fim

```
~/code/mindops/solucoes/via-motor-comercial/
├── MERGE.md                          três matrizes decididas
├── CUTOVER.md                        roteiro com verificação e reversão por passo
├── PDCA.md                           diário: planejei / fiz / a prova mostrou / mudei
├── merge/
│   ├── inventario-bc.json  inventario-wa.json  inventario-nina.json
│   ├── mapa-destinos.json            portado | fundido | equivalente
│   └── dominios-tabelas.json         domínio e dono de cada tabela
├── supabase/migrations/              escritas por mim, aplicadas pelo Lovable
├── provas/*.sql                      as oito provas
├── scripts/cobertura.mjs             gate de cobertura (da skill)
└── src/modules/*                     os oito módulos
```

---

## Riscos

| Risco | Impacto | Mitigação |
|---|---|---|
| **Migração de tenancy** `user_id` → `workspace_id` em metade do trunk | alto — erra e vaza dado entre clientes | fase 2 isolada, com `prova-permissao.sql` verde antes de qualquer tela |
| Repo GitHub não conectado | bloqueia git-first | passo manual na UI; código escrito localmente enquanto isso |
| BC fechou com "Fixed public access issues" | padrões de RLS dele podem estar furados | não copiar policy do BC; RLS é **gerada** a partir de `dominios-tabelas.json` |
| Três provedores de WhatsApp | dupla escrita e mensagem duplicada | motor único `send_queue`; provider é adapter, não caminho |
| Evolution API é não oficial | risco de ban do número | preferir Meta Cloud API como padrão; Evolution só onde já está em uso |
| Banco novo vazio | expectativa de "já vem com os dados" | fase 2b explícita, sob confirmação da fonte de produção de cada doador |
| Agente do Lovable "consertando" por conta | quebra silenciosa | knowledge já grava o papel de executor; toda mudança entra por commit meu |

---

## Próximo passo imediato

1. Conectar o repo GitHub ao projeto `[VIA] Motor Comercial` (único passo que não é meu).
2. Escrever `MERGE.md` e `dominios-tabelas.json` a partir das três matrizes acima.
3. Fase 2: migration de tenancy + `contacts` unificado + `prova-espinha.sql`.

Nada é declarado pronto sem prova executada no banco real, com rollback, e a evidência colada
no `PDCA.md`.
