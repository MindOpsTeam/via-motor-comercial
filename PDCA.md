# PDCA — Confluência do [VIA] Motor Comercial

Diário da fusão. Uma entrada por ciclo: o que planejei, o que fiz, o que a prova
mostrou, o que mudei por causa dela.

---

## Ciclo 1 · 2026-09-08 — Espinha, idempotência e concatenação do fluxo

### Planejei

Garantir duas coisas no banco antes de qualquer tela:

1. **Idempotência** — repetir qualquer operação do fluxo não duplica nem corrompe.
2. **Concatenação** — o fluxo é um inteiro (`empresa → decisor → cadência → envio →
   conversa → CRM`), com cada etapa entregando para a próxima no mesmo bloco
   transacional, sem processo intermediário e sem reconciliação manual.

### Fiz

Seis blocos, aplicados um por chamada no banco real (`jcxuzwn…`):

| Migration | O que entrega |
|---|---|
| `…200001_espinha_tenancy_unificada` | `workspace_id NOT NULL` em 38 tabelas; guardas `is_workspace_member` / `is_workspace_admin` / `current_workspace_id`; 9 chaves naturais migradas de globais para por-workspace |
| `…200002_espinha_fluxo_concatenado` | 11 tabelas dos doadores (prospecção, listas N:N, cadência, campanha); `journey_events`; `normalize_phone`; 10 chaves de idempotência |
| `…200003_rpc_porta_unica_do_fluxo` | 13 RPCs como porta única + a view `v_flow_pipeline` |
| `…200004_rls_por_dominio` | 177 policies em 49 tabelas, geradas por domínio (negócio / máquina / pessoal) |
| `…200005_autoridade_de_campo_triggers` | remove a dupla escrita de `deals`; deduplica triggers de `updated_at` |
| `…200006_vocabulario_de_atividade` | vocabulário de `deal_activities.type` que o sistema também consegue usar |

### O que a prova mostrou

`provas/prova-fluxo-ponta-a-ponta.sql`, executada no banco real, com rollback.

**Resultado: 13 de 13 asserções verdes.**

```json
{
  "A_empresa_idempotente":           true,
  "B_contato_3_formatos_1_registro": true,
  "C_inscricao_unica":               true,
  "D_envio_dedupe":                  true,
  "E_inbound_idempotente":           true,
  "F_resposta_matou_cadencia":       true,
  "G_envio_pendente_cancelado":      true,
  "H_deal_automatico_e_unico":       true,
  "I_move_sem_atividade_duplicada":  true,
  "J_webhook_dedupe":                true,
  "K_inbound_reconheceu_o_contato":  true,
  "L_etapa_no_fluxo":                "crm",
  "M_fronteira_entre_workspaces":    true,
  "medidas": { "empresas": 1, "contatos": 1, "fila": 1, "mensagens": 1,
               "cadencias_ativas": 0, "cancelados": 1, "deals": 1,
               "atividades": 1, "eventos_jornada": 6 }
}
```

Lido em português: duas chamadas de empresa com o mesmo domínio deram **1 empresa**;
o mesmo telefone em três formatos (`+55 (11) 91234-5678`, `5511912345678`,
`011912345678`) deu **1 contato**; dois enfileiramentos com a mesma chave deram
**1 linha na fila**; o mesmo `wamid` entregue duas vezes deu **1 mensagem** e a
segunda chamada devolveu `duplicada: true`; a resposta do lead **parou a cadência
e cancelou o envio pendente**; a oportunidade nasceu sozinha e **única**; mover o
deal duas vezes para o mesmo estágio gerou **1 atividade**; e o mesmo telefone em
outro workspace virou **outro contato**, sem vazamento.

Depois do `RAISE EXCEPTION` o banco voltou a zero — conferido: 0 contatos, 0 deals,
0 mensagens, 0 eventos.

### O que mudei por causa da prova

Três defeitos que só apareceram porque a prova rodou contra o banco real:

**1. `normalize_phone` transformava telefone fixo em celular.**
A primeira versão inseria o nono dígito em qualquer número de 8 dígitos locais, então
`11 3214-5678` virava `11 93214-5678` — um número que não existe. Também não removia o
`0` do DDD, e `011912345678` virava `+011912345678`, um contato órfão. Corrigido: o
nono dígito só entra quando o número local começa em 6–9 (faixa de celular), e o
prefixo de trunk é removido antes. Dez casos conferidos, todos corretos.

**2. Um trigger legado criava `deals` por fora da porta única.**
`auto_create_deal_on_contact` (AFTER INSERT em `contacts`) não estava em migration
nenhuma do repo — vive só no banco, que é exatamente o motivo de a skill mandar ler o
retrato antes de escrever. Ele quebrava todo INSERT em `contacts` depois da migração de
tenancy (não conhecia `workspace_id`) e, pior, disputava com `crm_ensure_deal()` a
autoridade sobre a criação de oportunidade. Removido: um dono só.

Efeito colateral bom: o trigger abria um deal para **cada** contato prospectado. Uma
busca de 500 empresas colocava 500 oportunidades frias no funil no primeiro dia. Agora
o deal nasce quando existe sinal — o lead respondeu — ou quando o operador decide.

**3. `deal_activities.type` não tinha vocabulário para o próprio sistema.**
O check só aceitava `note, call, email, meeting, task`, então `crm_move_deal()` não
conseguia registrar a movimentação de estágio e o funil andava sem deixar rastro.
Vocabulário ampliado com os tipos que o fluxo grava: `stage_change`, `won`, `lost`,
`inbound`, `followup_sent`, `system`.

### Achado registrado, ainda sem ação

Sete tabelas chegaram do remix com RLS **ligada e zero policies** — na prática
invisíveis para qualquer usuário logado, e um erro esperando o primeiro SELECT do
front: `send_queue`, `nina_processing_queue`, `message_processing_queue`,
`message_grouping_queue`, `calendar_integrations`, `calendar_oauth_states`,
`agent_operation_rate_limits`. A migration `…200004` classificou cada uma: as filas
ficaram no domínio máquina (só `service_role`, com uma exceção deliberada de leitura da
fila de envio para o operador entender por que uma mensagem não saiu) e as demais
entraram no domínio negócio.

### Próximo ciclo

- Portar as edge functions dos doadores para chamarem as RPCs em vez de escreverem
  direto nas tabelas (o gate de cobertura da fase 3).
- Prova de permissão por perfil, perfil a perfil, com usuário real autenticado.
- Telas dos módulos de prospecção e cadência.
