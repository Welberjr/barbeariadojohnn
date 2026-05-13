'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';

const BARBERSHOP_ID = '11111111-1111-1111-1111-111111111111';

export interface CreateComandaData {
  customer_id: string;
  staff_id: string;
  appointment_id?: string | null;
}

/**
 * Abre uma nova comanda (atendimento em curso).
 */
export async function createComanda(data: CreateComandaData) {
  const admin = createAdminClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payload: any = {
    barbershop_id: BARBERSHOP_ID,
    customer_id: data.customer_id,
    staff_id: data.staff_id,
    status: 'open',
    subtotal: 0,
    discount_type: 'percentage',
    discount_value: 0,
    total: 0,
    card_fee_total: 0,
    net_total: 0,
    opened_at: new Date().toISOString(),
  };

  if (data.appointment_id) payload.appointment_id = data.appointment_id;

  const { data: created, error } = await admin
    .from('comandas')
    .insert(payload)
    .select()
    .single();

  if (error) return { ok: false, error: error.message };

  revalidatePath('/admin/comandas');
  return { ok: true, comanda: created };
}

/**
 * Adiciona um serviço à comanda (insere em comanda_items com item_type='service').
 */
export async function addServiceToComanda(
  comandaId: string,
  serviceId: string,
  staffId: string,
  price: number,
  quantity = 1
) {
  const admin = createAdminClient();

  // Buscar nome do serviço + commission_percent do staff em paralelo
  const [{ data: service }, { data: staff }] = await Promise.all([
    admin.from('services').select('name').eq('id', serviceId).maybeSingle(),
    admin
      .from('staff')
      .select('default_commission_percent')
      .eq('id', staffId)
      .maybeSingle(),
  ]);

  const commissionPercent = Number(staff?.default_commission_percent ?? 0);
  const totalPrice = price * quantity;
  const commissionValue = (totalPrice * commissionPercent) / 100;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payload: any = {
    barbershop_id: BARBERSHOP_ID,
    comanda_id: comandaId,
    item_type: 'service',
    service_id: serviceId,
    name: service?.name ?? 'Serviço',
    quantity,
    unit_price: price,
    total_price: totalPrice,
    staff_id: staffId,
    commission_percent: commissionPercent,
    commission_value: commissionValue,
  };

  const { error } = await admin.from('comanda_items').insert(payload);
  if (error) return { ok: false, error: error.message };

  await recalculateComandaTotal(comandaId);

  revalidatePath('/admin/comandas');
  return { ok: true };
}

/**
 * Adiciona um produto à comanda (insere em comanda_items com item_type='product').
 */
export async function addProductToComanda(
  comandaId: string,
  productId: string,
  price: number,
  quantity = 1
) {
  const admin = createAdminClient();

  const { data: product } = await admin
    .from('products')
    .select('name')
    .eq('id', productId)
    .maybeSingle();

  const totalPrice = price * quantity;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payload: any = {
    barbershop_id: BARBERSHOP_ID,
    comanda_id: comandaId,
    item_type: 'product',
    product_id: productId,
    name: product?.name ?? 'Produto',
    quantity,
    unit_price: price,
    total_price: totalPrice,
    commission_percent: 0,
    commission_value: 0,
  };

  const { error } = await admin.from('comanda_items').insert(payload);
  if (error) return { ok: false, error: error.message };

  await recalculateComandaTotal(comandaId);

  revalidatePath('/admin/comandas');
  return { ok: true };
}

/**
 * Remove um item da comanda (qualquer item_type).
 */
export async function removeComandaItem(
  comandaId: string,
  itemId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _type: 'service' | 'product'
) {
  const admin = createAdminClient();

  const { error } = await admin.from('comanda_items').delete().eq('id', itemId);
  if (error) return { ok: false, error: error.message };

  await recalculateComandaTotal(comandaId);

  revalidatePath('/admin/comandas');
  return { ok: true };
}

/**
 * Recalcula o total da comanda baseado nos itens (somando comanda_items.total_price).
 */
async function recalculateComandaTotal(comandaId: string) {
  const admin = createAdminClient();

  const { data: items } = await admin
    .from('comanda_items')
    .select('total_price')
    .eq('comanda_id', comandaId);

  const subtotal =
    items?.reduce((sum, i) => sum + Number(i.total_price), 0) ?? 0;

  await admin
    .from('comandas')
    .update({
      subtotal,
      total: subtotal,
      net_total: subtotal,
    })
    .eq('id', comandaId);
}

/**
 * Fecha a comanda (transforma em venda) — insere pagamento em comanda_payments.
 */
export async function closeComanda(
  comandaId: string,
  paymentMethod: string,
  discount = 0,
  tip = 0
) {
  const admin = createAdminClient();

  // Buscar subtotal atualizado
  const { data: comanda } = await admin
    .from('comandas')
    .select('subtotal')
    .eq('id', comandaId)
    .maybeSingle();

  if (!comanda) return { ok: false, error: 'Comanda não encontrada' };

  const subtotal = Number(comanda.subtotal);
  const total = subtotal - discount + tip;
  // discount_value armazena percentual (não valor absoluto)
  const discountPct =
    discount > 0 && subtotal > 0 ? (discount / subtotal) * 100 : 0;

  // 1. Atualiza comanda para closed
  const { error: errUpdate } = await admin
    .from('comandas')
    .update({
      status: 'closed',
      discount_type: 'percentage',
      discount_value: discountPct,
      total,
      net_total: total,
      closed_at: new Date().toISOString(),
    })
    .eq('id', comandaId);

  if (errUpdate) return { ok: false, error: errUpdate.message };

  // 2. Cria o pagamento em comanda_payments
  const { error: errPayment } = await admin.from('comanda_payments').insert({
    barbershop_id: BARBERSHOP_ID,
    comanda_id: comandaId,
    method: paymentMethod,
    amount: total,
    installments: 1,
    fee_percent: 0,
    fee_value: 0,
    net_amount: total,
  });

  if (errPayment) return { ok: false, error: errPayment.message };

  revalidatePath('/admin/comandas');
  revalidatePath('/admin/agenda');
  revalidatePath('/admin');
  return { ok: true };
}

/**
 * Cancela uma comanda aberta.
 */
export async function cancelComanda(comandaId: string) {
  const admin = createAdminClient();

  const { error } = await admin
    .from('comandas')
    .update({
      status: 'cancelled',
      closed_at: new Date().toISOString(),
    })
    .eq('id', comandaId);

  if (error) return { ok: false, error: error.message };

  revalidatePath('/admin/comandas');
  return { ok: true };
}
