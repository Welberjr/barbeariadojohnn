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
 * Se vinculada a um appointment, marca-o como 'in_progress' automaticamente.
 */
export async function createComanda(data: CreateComandaData) {
  const admin = createAdminClient();

  // Se houver appointment, verificar se já existe comanda vinculada
  if (data.appointment_id) {
    const { data: existing } = await admin
      .from('comandas')
      .select('id, status')
      .eq('appointment_id', data.appointment_id)
      .in('status', ['open', 'closed'])
      .maybeSingle();

    if (existing) {
      // Já existe comanda vinculada ao agendamento; reutiliza
      return { ok: true, comanda: existing, reused: true };
    }
  }

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

  // Integração: ao abrir comanda vinculada a appointment, marca-o como in_progress
  if (data.appointment_id) {
    await admin
      .from('appointments')
      .update({ status: 'in_progress' })
      .eq('id', data.appointment_id)
      .in('status', ['scheduled']); // só atualiza se ainda estiver scheduled
  }

  revalidatePath('/admin/comandas');
  revalidatePath('/admin/agenda');
  return { ok: true, comanda: created };
}

/**
 * Pré-popula a comanda com os serviços que estavam no agendamento.
 * Útil quando se abre a comanda a partir de um appointment.
 */
export async function populateComandaFromAppointment(
  comandaId: string,
  appointmentId: string
) {
  const admin = createAdminClient();

  // Buscar serviços do agendamento
  const { data: apptServices } = await admin
    .from('appointment_services')
    .select('service_id, price, commission_percent')
    .eq('appointment_id', appointmentId);

  if (!apptServices || apptServices.length === 0) {
    return { ok: true, added: 0 };
  }

  // Buscar comanda para pegar staff_id
  const { data: comanda } = await admin
    .from('comandas')
    .select('staff_id')
    .eq('id', comandaId)
    .maybeSingle();

  const staffId = comanda?.staff_id as string | null;

  // Buscar nomes dos serviços
  const serviceIds = apptServices.map((s) => s.service_id);
  const { data: services } = await admin
    .from('services')
    .select('id, name')
    .in('id', serviceIds);
  const nameMap = new Map(
    (services ?? []).map((s) => [s.id as string, s.name as string])
  );

  // Inserir como items da comanda
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const itemsToInsert = apptServices.map((s: any) => ({
    barbershop_id: BARBERSHOP_ID,
    comanda_id: comandaId,
    item_type: 'service',
    service_id: s.service_id,
    name: nameMap.get(s.service_id as string) ?? 'Serviço',
    quantity: 1,
    unit_price: Number(s.price ?? 0),
    total_price: Number(s.price ?? 0),
    staff_id: staffId,
    commission_percent: Number(s.commission_percent ?? 0),
    commission_value:
      (Number(s.price ?? 0) * Number(s.commission_percent ?? 0)) / 100,
  }));

  const { error } = await admin.from('comanda_items').insert(itemsToInsert);
  if (error) return { ok: false, error: error.message };

  await recalculateComandaTotal(comandaId);

  revalidatePath('/admin/comandas');
  return { ok: true, added: itemsToInsert.length };
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
 * Também decrementa stock_current do produto.
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
    .select('name, stock_current, default_commission_percent')
    .eq('id', productId)
    .maybeSingle();

  // Buscar staff_id da comanda (vendedor recebe comissão do produto)
  const { data: comanda } = await admin
    .from('comandas')
    .select('staff_id')
    .eq('id', comandaId)
    .maybeSingle();

  const staffId = comanda?.staff_id as string | null;
  const totalPrice = price * quantity;
  const productCommission = Number(
    product?.default_commission_percent ?? 0
  );
  const commissionValue = (totalPrice * productCommission) / 100;

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
    staff_id: staffId,
    commission_percent: productCommission,
    commission_value: commissionValue,
  };

  const { error } = await admin.from('comanda_items').insert(payload);
  if (error) return { ok: false, error: error.message };

  // Decrementa estoque
  const newStock = Math.max(
    0,
    Number(product?.stock_current ?? 0) - quantity
  );
  await admin
    .from('products')
    .update({ stock_current: newStock })
    .eq('id', productId);

  await recalculateComandaTotal(comandaId);

  revalidatePath('/admin/comandas');
  revalidatePath('/admin/produtos');
  return { ok: true };
}

/**
 * Remove um item da comanda (qualquer item_type).
 * Se for produto, devolve quantidade ao estoque.
 */
export async function removeComandaItem(
  comandaId: string,
  itemId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _type: 'service' | 'product'
) {
  const admin = createAdminClient();

  // Antes de remover, verificar se é produto pra devolver estoque
  const { data: item } = await admin
    .from('comanda_items')
    .select('item_type, product_id, quantity')
    .eq('id', itemId)
    .maybeSingle();

  if (item?.item_type === 'product' && item.product_id) {
    const { data: prod } = await admin
      .from('products')
      .select('stock_current')
      .eq('id', item.product_id)
      .maybeSingle();
    const newStock =
      Number(prod?.stock_current ?? 0) + Number(item.quantity ?? 0);
    await admin
      .from('products')
      .update({ stock_current: newStock })
      .eq('id', item.product_id);
  }

  const { error } = await admin.from('comanda_items').delete().eq('id', itemId);
  if (error) return { ok: false, error: error.message };

  await recalculateComandaTotal(comandaId);

  revalidatePath('/admin/comandas');
  revalidatePath('/admin/produtos');
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
 * Se vinculada a appointment, marca-o como 'completed'.
 * Atualiza total_appointments e total_spent do cliente.
 */
export async function closeComanda(
  comandaId: string,
  paymentMethod: string,
  discount = 0,
  tip = 0
) {
  const admin = createAdminClient();

  const { data: comanda } = await admin
    .from('comandas')
    .select('subtotal, appointment_id, customer_id, total')
    .eq('id', comandaId)
    .maybeSingle();

  if (!comanda) return { ok: false, error: 'Comanda não encontrada' };

  const subtotal = Number(comanda.subtotal);
  const total = subtotal - discount + tip;
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

  // 3. Integração: marca appointment como completed se houver
  if (comanda.appointment_id) {
    await admin
      .from('appointments')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        comanda_id: comandaId,
      })
      .eq('id', comanda.appointment_id);
  }

  // 4. Atualiza estatísticas do cliente
  if (comanda.customer_id) {
    const { data: customer } = await admin
      .from('customers')
      .select('total_appointments, total_spent')
      .eq('id', comanda.customer_id)
      .maybeSingle();

    if (customer) {
      await admin
        .from('customers')
        .update({
          total_appointments:
            Number(customer.total_appointments ?? 0) + 1,
          total_spent: Number(customer.total_spent ?? 0) + total,
        })
        .eq('id', comanda.customer_id);
    }
  }

  revalidatePath('/admin/comandas');
  revalidatePath('/admin/agenda');
  revalidatePath('/admin');
  revalidatePath('/admin/financeiro');
  return { ok: true };
}

/**
 * Cancela uma comanda aberta.
 * Devolve estoque dos produtos.
 */
export async function cancelComanda(comandaId: string) {
  const admin = createAdminClient();

  // Devolve estoque dos produtos
  const { data: items } = await admin
    .from('comanda_items')
    .select('item_type, product_id, quantity')
    .eq('comanda_id', comandaId)
    .eq('item_type', 'product');

  for (const item of items ?? []) {
    if (!item.product_id) continue;
    const { data: prod } = await admin
      .from('products')
      .select('stock_current')
      .eq('id', item.product_id)
      .maybeSingle();
    const newStock =
      Number(prod?.stock_current ?? 0) + Number(item.quantity ?? 0);
    await admin
      .from('products')
      .update({ stock_current: newStock })
      .eq('id', item.product_id);
  }

  const { error } = await admin
    .from('comandas')
    .update({
      status: 'cancelled',
      closed_at: new Date().toISOString(),
    })
    .eq('id', comandaId);

  if (error) return { ok: false, error: error.message };

  revalidatePath('/admin/comandas');
  revalidatePath('/admin/produtos');
  return { ok: true };
}
