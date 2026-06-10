'use server';

import { createClient } from '@/lib/supabase/server';
import { createMPPreference } from '@/lib/mercadopago';
import { revalidatePath } from 'next/cache';

const BARBERSHOP_ID = '11111111-1111-1111-1111-111111111111';

/**
 * Gera link de pagamento online (Mercado Pago) para uma comanda aberta.
 * Retorna initPoint (URL pra abrir o checkout).
 */
export async function generateMPCheckoutForComanda(comandaId: string) {
  const admin = await createClient();

  // Busca comanda + items + customer
  const { data: comanda } = await admin
    .from('comandas')
    .select(
      'id, total, status, customer_id, mp_preference_id, mp_init_point'
    )
    .eq('id', comandaId)
    .maybeSingle();

  if (!comanda) {
    return { ok: false, error: 'Comanda não encontrada' };
  }

  if (comanda.status === 'closed') {
    return { ok: false, error: 'Comanda já está fechada' };
  }

  // Idempotência: se já tem link gerado, retorna o existente
  if (comanda.mp_preference_id && comanda.mp_init_point) {
    return {
      ok: true,
      cached: true,
      preferenceId: comanda.mp_preference_id,
      initPoint: comanda.mp_init_point,
    };
  }

  const { data: items } = await admin
    .from('comanda_items')
    .select('name, quantity, unit_price')
    .eq('comanda_id', comandaId);

  if (!items || items.length === 0) {
    return { ok: false, error: 'Comanda sem itens' };
  }

  // Customer info (opcional para preencher checkout)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let customer: any = null;
  if (comanda.customer_id) {
    const { data: c } = await admin
      .from('customers')
      .select('full_name, phone, email')
      .eq('id', comanda.customer_id)
      .maybeSingle();
    customer = c;
  }

  const result = await createMPPreference({
    items: items.map((i) => ({
      title: i.name as string,
      quantity: Number(i.quantity ?? 1),
      unit_price: Number(i.unit_price ?? 0),
    })),
    external_reference: `comanda:${comandaId}`,
    payer: customer
      ? {
          name: customer.full_name,
          email: customer.email ?? undefined,
          phone: customer.phone ?? undefined,
        }
      : undefined,
  });

  if (!result.ok || !result.preferenceId || !result.initPoint) {
    return { ok: false, error: result.error ?? 'Erro ao criar preference' };
  }

  // Salva referência na comanda
  await admin
    .from('comandas')
    .update({
      mp_preference_id: result.preferenceId,
      mp_init_point: result.initPoint,
    })
    .eq('id', comandaId);

  revalidatePath('/admin/comandas');
  revalidatePath(`/admin/comandas/${comandaId}`);

  return {
    ok: true,
    mocked: result.mocked,
    preferenceId: result.preferenceId,
    initPoint: result.initPoint,
  };
}

/**
 * Atualiza configuração do Mercado Pago no barbershops.
 */
export async function updateMPConfig(data: {
  enabled: boolean;
  public_key?: string;
  access_token?: string;
}) {
  const admin = await createClient();

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
    .eq('id', BARBERSHOP_ID);

  if (error) return { ok: false, error: error.message };

  revalidatePath('/admin/configuracoes');
  return { ok: true };
}
