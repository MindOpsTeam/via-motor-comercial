/**
 * followup-enroller — inscreve contatos numa cadência.
 *
 * Portado do doador A (603 linhas → ~120). O original resolvia sozinho a
 * duplicidade de inscrição com um SELECT antes do INSERT, o que é uma corrida
 * esperando acontecer: dois gatilhos simultâneos passavam os dois pelo SELECT e
 * inscreviam o mesmo contato duas vezes. Agora quem garante é o índice único
 * parcial `uq_followup_enrollment_ativa`, e a RPC devolve a inscrição que já
 * existe em vez de criar outra.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, enrollFollowup, json } from '../_shared/flow.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const service = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    const { sequence_id, contact_ids, list_id, variables } = await req.json();
    if (!sequence_id) throw new Error('sequence_id é obrigatório');

    const { data: sequencia, error: seqError } = await service
      .from('followup_sequences')
      .select('id, workspace_id, status')
      .eq('id', sequence_id)
      .single();
    if (seqError || !sequencia) throw new Error('Sequência não encontrada');
    if (sequencia.status !== 'active') throw new Error('Sequência não está ativa');

    // Alvos: lista explícita de contatos, ou todos os membros de uma lista.
    let alvos: string[] = Array.isArray(contact_ids) ? contact_ids : [];
    if (list_id) {
      const { data: membros, error } = await service
        .from('contact_list_members')
        .select('contact_id')
        .eq('list_id', list_id)
        .eq('workspace_id', sequencia.workspace_id);
      if (error) throw new Error(`lista: ${error.message}`);
      alvos = alvos.concat((membros ?? []).map((m: { contact_id: string }) => m.contact_id));
    }
    alvos = [...new Set(alvos)];
    if (alvos.length === 0) throw new Error('Nenhum contato para inscrever');

    let inscritos = 0;
    let bloqueados = 0;
    let jaEstavam = 0;
    const erros: string[] = [];

    for (const contactId of alvos) {
      try {
        const antes = await service
          .from('followup_enrollments')
          .select('id', { count: 'exact', head: true })
          .eq('sequence_id', sequence_id)
          .eq('contact_id', contactId)
          .in('status', ['active', 'paused']);

        const id = await enrollFollowup(service, sequence_id, contactId, variables ?? {});

        // null = contato bloqueado. É a regra funcionando, não uma falha.
        if (id === null) bloqueados++;
        else if ((antes.count ?? 0) > 0) jaEstavam++;
        else inscritos++;
      } catch (err) {
        erros.push(`${contactId}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    console.log(`[followup-enroller] ${inscritos} inscritos, ${jaEstavam} já estavam, ${bloqueados} bloqueados, ${erros.length} erros`);
    return json({ inscritos, ja_estavam: jaEstavam, bloqueados, erros });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[followup-enroller] ${message}`);
    return json({ error: message }, 500);
  }
});
