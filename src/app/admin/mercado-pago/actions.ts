'use server';

import { createManagerClient } from '@/lib/supabase/manager';
import { revalidatePath } from 'next/cache';

import { lojaAtual } from '@/lib/loja';

/**
 * Atualiza configuração do Mercado Pago no barbershops.
 */
export async function updateMPConfig(data: {
  enabled: boolean;
  public_key?: string;
  access_token?: string;
}) {
  const admin = await createManagerClient();

  const cleaned: Record<string, unknown> = {
    enabled: data.enabled,
  };
  if (data.public_key !== undefined) {
    cleaned.public_key = data.public_key.trim() || null;
  }
  if (data.access_token !== undefined) {
    cleaned.access_token = data.access_token.trim() || null;
  }
  cleaned.notification_url =
    'https://barbearia-do-johnn.vercel.app/api/mp/webhook';

  const { error } = await admin
    .from('barbershops')
    .update({ mp_config: cleaned })
    .eq('id', (await lojaAtual()));

  if (error) return { ok: false, error: error.message };

  revalidatePath('/admin/configuracoes');
  return { ok: true };
}
