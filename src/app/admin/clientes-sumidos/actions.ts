'use server';

import { createManagerClient } from '@/lib/supabase/manager';
import { revalidatePath } from 'next/cache';
import { getSessionStaff } from '@/lib/staff-auth';

/**
 * Marca que a barbearia ja chamou este cliente de volta.
 * Serve para duas pessoas nao ligarem para o mesmo cliente no mesmo dia, e
 * para a lista mostrar quem ainda nao foi procurado.
 */
export async function marcarContatoFeito(customerId: string, observacao?: string) {
  const admin = await createManagerClient();
  const quem = await getSessionStaff();

  const { error } = await admin
    .from('customers')
    .update({
      reactivation_contacted_at: new Date().toISOString(),
      reactivation_contacted_by: quem?.profileId ?? null,
      reactivation_notes: observacao?.trim() || null,
    })
    .eq('id', customerId);

  if (error) return { ok: false, error: error.message };

  revalidatePath('/admin/clientes-sumidos');
  return { ok: true };
}

/** Desfaz a marcacao, para o cliente voltar para a fila de quem chamar. */
export async function desfazerContato(customerId: string) {
  const admin = await createManagerClient();

  const { error } = await admin
    .from('customers')
    .update({
      reactivation_contacted_at: null,
      reactivation_contacted_by: null,
      reactivation_notes: null,
    })
    .eq('id', customerId);

  if (error) return { ok: false, error: error.message };

  revalidatePath('/admin/clientes-sumidos');
  return { ok: true };
}
