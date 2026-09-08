-- ============================================================================
-- Confluência · Fase 4 · Bloco 5 — Autoridade de campo: remover a dupla escrita
-- ----------------------------------------------------------------------------
-- O retrato do banco entregou o que o código do repo não mostrava: um trigger
-- legado criando `deals` por fora da porta única.
--
--   auto_create_deal_on_contact  (AFTER INSERT em contacts)
--     -> INSERT INTO deals (contact_id, title, stage_id, stage, user_id, ...)
--
-- Dois problemas, um de cada tipo:
--
--   1. ESTRUTURAL — a função não conhece workspace_id. Depois da fase 2 ela
--      simplesmente quebra todo INSERT em contacts com
--      "null value in column workspace_id violates not-null constraint".
--      Foi assim que a prova o encontrou.
--
--   2. DE AUTORIDADE — dois donos escrevendo a mesma entidade: o trigger e a
--      RPC crm_ensure_deal(). É a dupla escrita silenciosa que a matriz 3 da
--      fase 0 existe para impedir.
--
-- Decisão: a criação de oportunidade tem UM dono, `crm_ensure_deal()`.
--
-- Ganho de produto, não só de arquitetura: o trigger abria um deal para CADA
-- contato prospectado. Numa busca de 500 empresas isso são 500 oportunidades
-- frias no funil no primeiro dia, e o funil deixa de significar qualquer coisa.
-- No fluxo concatenado o deal nasce quando existe sinal — o lead respondeu
-- (flow_ingest_inbound chama crm_ensure_deal) — ou quando o operador decide.
-- ============================================================================

drop trigger if exists auto_create_deal_on_contact on public.contacts;
drop function if exists public.auto_create_deal_on_contact();

-- ---------------------------------------------------------------------------
-- Higiene: o remix trouxe o mesmo trigger de updated_at até três vezes por
-- tabela. Três disparos para escrever o mesmo now() é desperdício em toda
-- escrita. Fica um por tabela.
-- ---------------------------------------------------------------------------
do $$
declare r record;
begin
  for r in
    select c.relname as tabela, t.tgname as trigger,
           row_number() over (partition by c.relname order by t.tgname) as n
      from pg_trigger t
      join pg_class c on c.oid = t.tgrelid
      join pg_namespace ns on ns.oid = c.relnamespace
      join pg_proc p on p.oid = t.tgfoid
     where ns.nspname = 'public'
       and not t.tgisinternal
       and p.proname = 'update_updated_at_column'
  loop
    if r.n > 1 then
      execute format('drop trigger if exists %I on public.%I', r.trigger, r.tabela);
    end if;
  end loop;
end $$;

-- contacts mantém apenas o trigger de normalização, que já escreve updated_at.
drop trigger if exists contacts_updated_at on public.contacts;
drop trigger if exists set_updated_at on public.contacts;
drop trigger if exists update_contacts_updated_at on public.contacts;

comment on function public.crm_ensure_deal(uuid, uuid, text) is
  'Porta única de criação de oportunidade. Substituiu o trigger auto_create_deal_on_contact.';
