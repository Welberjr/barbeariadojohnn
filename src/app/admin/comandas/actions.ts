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
 * Adiciona um serviço à comanda.
 */
export async function addServiceToComanda(
  comandaId: string,
  serviceId: string,
  staffId: string,
  price: number,
  quantity = 1
) {
  const admin = createAdminClient();

  // Tenta inserir em comanda_services
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payload: any = {
    comanda_id: comandaId,
    service_id: serviceId,
    staff_id: staffId,
    unit_price: price,
    quantity,
    subtotal: price * quantity,
  };

  const { error } = await admin.from('comanda_services').insert(payload);

  if (error) return { ok: false, error: error.message };

  // Recalcular total
  await recalculateComandaTotal(comandaId);

  revalidatePath('/admin/comandas');
  return { ok: true };
}

/**
 * Adiciona um produto à comanda.
 */
export async function addProductToComanda(
  comandaId: string,
  productId: string,
  price: number,
  quantity = 1
) {
  const admin = createAdminClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payload: any = {
    comanda_id: comandaId,
    product_id: productId,
    unit_price: price,
    quantity,
    subtotal: price * quantity,
  };

  const { error } = await admin.from('comanda_products').insert(payload);

  if (error) return { ok: false, error: error.message };

  await recalculateComandaTotal(comandaId);

  revalidatePath('/admin/comandas');
  return { ok: true };
}

/**
 * Remove um item da comanda.
 */
export async function removeComandaItem(
  comandaId: string,
  itemId: string,
  type: 'service' | 'product'
) {
  const admin = createAdminClient();

  const table = type === 'service' ? 'comanda_services' : 'comanda_products';
  const { error } = await admin.from(table).delete().eq('id', itemId);

  if (error) return { ok: false, error: error.message };

  await recalculateComandaTotal(comandaId);

  revalidatePath('/admin/comandas');
  return { ok: true };
}

/**
 * Recalcula o total da comanda baseado nos itens.
 */
async function recalculateComandaTotal(comandaId: string) {
  const admin = createAdminClient();

  // Soma serviços
  const { data: services } = await admin
    .from('comanda_services')
    .select('subtotal')
    .eq('comanda_id', comandaId);

  // Soma produtos
  const { data: products } = await admin
    .from('comanda_products')
    .select('subtotal')
    .eq('comanda_id', comandaId);

  const serviceTotal =
    services?.reduce((sum, s) => sum + Number(s.subtotal), 0) ?? 0;
  const productTotal =
    products?.reduce((sum, p) => sum + Number(p.subtotal), 0) ?? 0;
  const total = serviceTotal + productTotal;

  await admin
    .from('comandas')
    .update({
      service_total: serviceTotal,
      product_total: productTotal,
      subtotal: total,
      total,
    })
    .eq('id', comandaId);
}

/**
 * Fecha a comanda (transforma em venda).
 */
export async function closeComanda(
  comandaId: string,
  paymentMethod: string,
  discount = 0,
  tip = 0
) {
  const admin = createAdminClient();

  // Buscar a comanda atual
  const { data: comanda } = await admin
    .from('comandas')
    .select('subtotal')
    .eq('id', comandaId)
    .maybeSingle();

  if (!comanda) return { ok: false, error: 'Comanda não encontrada' };

  const subtotal = Number(comanda.subtotal);
  const total = subtotal - discount + tip;

  const { error } = await admin
    .from('comandas')
    .update({
      status: 'closed',
      payment_method: paymentMethod,
      discount,
      tip,
      total,
      closed_at: new Date().toISOString(),
    })
    .eq('id', comandaId);

  if (error) return { ok: false, error: error.message };

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
