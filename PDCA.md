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

Sete blocos, aplicados um por chamada no banco real (`jcxuzwn…`):

| Migration | O que entrega |
|---|---|
| `…200001_espinha_tenancy_unificada` | `workspace_id NOT NULL` em 38 tabelas; guardas `is_workspace_member` / `is_workspace_admin` / `current_workspace_id`; 9 chaves naturais migradas de globais para por-workspace |
| `…200002_espinha_fluxo_concatenado` | 11 tabelas dos doadores (prospecção, listas N:N, cadência, campanha); `journey_events`; `normalize_phone`; 10 chaves de idempotência |
| `…200003_rpc_porta_unica_do_fluxo` | 13 RPCs como porta única + a view `v_flow_pipeline` |
| `…200004_rls_por_dominio` | 177 policies em 49 tabelas, geradas por domínio (negócio / máquina / pessoal) |
| `…200005_autoridade_de_campo_triggers` | remove a dupla escrita de `deals`; deduplica triggers de `updated_at` |
| `…200006_vocabulario_de_atividade` | vocabulário de `deal_activities.type` que o sistema também consegue usar |
| `…200007_porta_unica_aceita_humano` | `flow_enqueue_send` passa a aceitar `from_type`; nasce `inbox_send_message` |

### O que a prova mostrou

`provas/prova-fluxo-ponta-a-ponta.sql`, executada no banco real, com rollback.

**Resultado: 15 de 15 asserções verdes.**

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
  "N_bloqueio_para_automacao":       true,
  "O_inbox_humano_dedupe":           true,
  "medidas": { "empresas": 1, "contatos": 1, "fila": 1, "mensagens": 1,
               "cadencias_ativas": 0, "cancelados": 1, "deals": 1,
               "atividades": 1, "eventos_jornada": 6, "fila_inbox": 1 }
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

Cinco defeitos que só apareceram porque a prova rodou contra o banco real e porque os
tipos gerados passaram a bater com o schema:

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

**4. O inbox escrevia direto na fila, por fora da porta única.**
`api.ts` fazia dois INSERTs em sequência — um em `messages`, outro em `send_queue` — sem
`workspace_id` e **sem chave de deduplicação**. Dois cliques no botão de enviar mandavam a
mesma mensagem duas vezes para o cliente; e se o segundo INSERT falhasse, ficava mensagem
registrada que nunca sairia.

A causa não era só o front: `flow_enqueue_send()` fixava `from_type = 'nina'`, então o inbox
**não tinha como** usar a porta única e por isso a contornava. Corrigir o front sem corrigir
a porta só empurraria o problema. Agora a porta aceita `from_type`, e `inbox_send_message()`
grava mensagem e fila numa transação só, com `dedupe_key` derivada do conteúdo.

Junto veio uma decisão de produto: contato bloqueado não recebe automação, mas o operador
humano que abre a conversa e escreve à mão continua podendo falar. O bloqueio serve para
parar robô, não para amordaçar quem atende.

**5. Um `DELETE` em `deals` que teria apagado oportunidade legítima.**
`CreateDealModal.tsx` rodava `delete from deals where contact_id = X` logo depois de criar o
contato, para limpar o deal que o trigger removido no item 2 criava sozinho. Com o trigger
fora, o `DELETE` virou não só desnecessário como perigoso: quando o contato já existia, ele
apagava o deal aberto que já estivesse lá. Removido.

No mesmo arquivo, a verificação de duplicidade comparava `phone_number` **cru** — então
`+55 11 91234-5678` e `5511912345678` não se encontravam e o mesmo decisor entrava duas
vezes. Passou a usar `flow_upsert_contact()`, que resolve pela chave natural normalizada.

### Achado registrado, ainda sem ação

Sete tabelas chegaram do remix com RLS **ligada e zero policies** — na prática
invisíveis para qualquer usuário logado, e um erro esperando o primeiro SELECT do
front: `send_queue`, `nina_processing_queue`, `message_processing_queue`,
`message_grouping_queue`, `calendar_integrations`, `calendar_oauth_states`,
`agent_operation_rate_limits`. A migration `…200004` classificou cada uma: as filas
ficaram no domínio máquina (só `service_role`, com uma exceção deliberada de leitura da
fila de envio para o operador entender por que uma mensagem não saiu) e as demais
entraram no domínio negócio.

### Verificação de front

`tsc --noEmit`: **0 erros**. `npm run build`: **verde**.

Os tipos foram regerados a partir do schema real (57 tabelas, 3 views, 32 funções, 11 enums,
141 relacionamentos), não do que o Lovable devolveu — ele sincronizou o commit mas não
regenerou `types.ts`. Foram esses tipos que denunciaram os defeitos 4 e 5: com o
`workspace_id` obrigatório, o compilador apontou exatamente onde o front ainda escrevia
com a fronteira antiga.

### O que o Lovable fez com o commit

Sincronizou `f8fb8b8` e **regenerou os tipos** — esses ficaram (o gerador oficial dele é
mais completo que o meu: 154 relacionamentos contra 141, e já inclui `inbox_send_message`).

Fora isso, fez o que eu pedi explicitamente que não fizesse: criou uma migration própria
(um `SELECT 1` inofensivo, para disparar a regeneração) e editou o front por conta.

As edições dele foram descartadas no merge, porque calavam o compilador sem resolver nada:
adicionou `workspace_id` **mantendo `user_id: null` ao lado**, preservou o INSERT direto em
`send_queue` (a violação da porta única) e preservou o `DELETE` em `deals`. O código que
ficou é o meu; os tipos, os dele.

É o padrão de sempre com essa plataforma: ela é o executor do commit, não a autora. Toda
mudança dela precisa ser conferida uma a uma.

### Próximo ciclo

- Portar as edge functions dos doadores para chamarem as RPCs em vez de escreverem
  direto nas tabelas (o gate de cobertura da fase 3).
- Prova de permissão por perfil, perfil a perfil, com usuário real autenticado.
- Telas dos módulos de prospecção e cadência.
