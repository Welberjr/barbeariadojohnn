'use server';

/**
 * Consultas de apoio da comanda: cliente, servico e produto.
 * Separadas das acoes de escrita para deixar claro o que so le.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { exigirModulo } from '@/lib/staff-auth';
import { BARBERSHOP_ID } from '@/lib/painel/dados';

export async function buscarClienteParaComanda(termo: string) {
  const acesso = await exigirModulo('comanda');
  if (!acesso.ok) return { ok: false as const, error: acesso.error };

  const busca = termo.trim();
  if (busca.length < 3) return { ok: true as const, clientes: [] };

  const admin = createAdminClient();
  const like = `%${busca}%`;

  const { data } = await admin
    .from('customers')
    .select('id, full_name, phone')
    .eq('barbershop_id', BARBERSHOP_ID)
    .eq('active', true)
    .or(`full_name.ilike.${like},phone.ilike.${like}`)
    .order('full_name')
    .limit(8);

  return {
    ok: true as const,
    clientes: (data ?? []).map((c) => ({
      id: c.id as string,
      full_name: c.full_name as string,
      phone: (c.phone as string) ?? null,
    })),
  };
}
