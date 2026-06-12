'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';
import { getActiveSubscription, isDayAllowed, formatAllowedDays } from '@/lib/subscriptions';
import { awardPointsForComanda } from '@/lib/loyalty';
import { notifyCustomer } from '@/lib/notifications';

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

  // Se houver appointment, verificar se ja existe comanda vinculada
  if (data.appointment_id) {
    const { data: existing } = await admin
      .from('comandas')
      .select('id, status')
      .eq('appointment_id', data.appointment_id)
      .in('status', ['open', 'closed'])
      .maybeSingle();

    if (existing) {
      // Ja existe comanda vinculada ao agendamento; reutiliza
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

  // Integracao: ao abrir comanda vinculada a appointment, marca-o como in_progress
  if (data.appointment_id) {
    await admin
      .from('appointments')
      .update({ status: 'in_progress' })
      .eq('id', data.appointment_id)
      .in('status', ['scheduled']);
  }

  revalidatePath('/admin/comandas');
  return { ok: true, comanda: created };
}

/**
 * Pre-popula a comanda com os servicos que estavam no agendamento.
 */
export async function populateComandaFromAppointment(
  comandaId: string,
  appointmentId: string
) {
  const admin = createAdminClient();

  const { data: apptServices } = await admin
    .from('appointment_services')
    .select('service_id, price, commission_percent')
    .eq('appointment_id', appointmentId);

  if (!apptServices || apptServices.length === 0) {
    return { ok: true, added: 0 };
  }

  const { data: comanda } = await admin
    .from('comandas')
    .select('staff_id')
    .eq('id', comandaId)
    .maybeSingle();

  const staffId = comanda?.staff_id as string | null;

  const serviceIds = apptServices.map((s) => s.service_id);
  const { data: services } = await admin
    .from('services')
    .select('id, name')
    .in('id', serviceIds);
  const nameMap = new Map(
    (services ?? []).map((s) => [s.id as string, s.name as string])
  );

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

  revalidatePath('/admin/comandas', 'layout');
  return { ok: true, added: itemsToInsert.length };
}

/**
 * Adiciona um servico a comanda.
 *
 * useSubscription = true: cobre o servico pela assinatura ativa do cliente.
 *  - preco do item vira 0 (cliente nao paga avulso)
 *  - registra o uso no ledger (subscription_usages) com o barbeiro que atendeu
 *  - valida: assinatura ativa, ciclo nao vencido, usos restantes,
 *    dia permitido pelo plano e servico incluso (quando o plano restringe)
 */
export async function addServiceToComanda(
  comandaId: string,
  serviceId: string,
  staffId: string,
  price: number,
  quantity = 1,
  useSubscription = false
) {
  const admin = createAdminClient();

  const [{ data: service }, { data: staff }, { data: comanda }] = await Promise.all([
    admin.from('services').select('name').eq('id', serviceId).maybeSingle(),
    admin
      .from('staff')
      .select('default_commission_percent')
      .eq('id', staffId)
      .maybeSingle(),
    admin
      .from('comandas')
      .select('customer_id, appointment_id, status')
      .eq('id', comandaId)
      .maybeSingle(),
  ]);

  if (!comanda) return { ok: false, error: 'Comanda não encontrada' };
  if (comanda.status !== 'open') {
    return { ok: false, error: 'Comanda não está aberta' };
  }

  // -------- Fluxo de cobertura pela assinatura --------
  if (useSubscription) {
    if (!comanda.customer_id) {
      return { ok: false, error: 'Comanda sem cliente vinculado' };
    }

    const sub = await getActiveSubscription(admin, comanda.customer_id as string);
    if (!sub) {
      return { ok: false, error: 'Cliente não tem assinatura ativa' };
    }
    if (sub.isExpired) {
      return {
        ok: false,
        error:
          'Ciclo da assinatura vencido. Lance o pagamento em Assinaturas antes de cobrir novos atendimentos.',
      };
    }
    if (sub.usesLeft <= 0) {
      return {
        ok: false,
        error: `Assinatura sem usos restantes neste ciclo (${sub.usedInCycle} de ${sub.plan.included_uses} já usados)`,
      };
    }

    const today = new Date();
    if (!isDayAllowed(today, sub.plan.allowed_days)) {
      return {
        ok: false,
        error: `Hoje não é dia do plano (${formatAllowedDays(sub.plan.allowed_days)}). Cobre como avulso ou escolha outro dia.`,
      };
    }

    // Se o plano restringe servicos, valida
    const { data: planServices } = await admin
      .from('subscription_plan_services')
      .select('service_id')
      .eq('plan_id', sub.plan.id);
    if (planServices && planServices.length > 0) {
      const allowed = planServices.some((p) => p.service_id === serviceId);
      if (!allowed) {
        return { ok: false, error: 'Este serviço não está incluso no plano' };
      }
    }

    // Item com preco zero (coberto)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const itemPayload: any = {
      barbershop_id: BARBERSHOP_ID,
      comanda_id: comandaId,
      item_type: 'service',
      service_id: serviceId,
      name: `${service?.name ?? 'Serviço'} (Assinatura)`,
      quantity: 1,
      unit_price: 0,
      total_price: 0,
      staff_id: staffId,
      commission_percent: 0,
      commission_value: 0,
      subscription_id: sub.id,
    };

    const { data: item, error: errItem } = await admin
      .from('comanda_items')
      .insert(itemPayload)
      .select('id')
      .single();
    if (errItem || !item) {
      return { ok: false, error: errItem?.message ?? 'Erro ao adicionar item' };
    }

    // Registra o uso no ledger (alimenta contador e potinho)
    const { data: usage, error: errUsage } = await admin
      .from('subscription_usages')
      .insert({
        barbershop_id: BARBERSHOP_ID,
        subscription_id: sub.id,
        appointment_id: comanda.appointment_id ?? null,
        service_id: serviceId,
        staff_id: staffId,
        comanda_id: comandaId,
        comanda_item_id: item.id,
        period_start: sub.current_period_start,
        period_end: sub.current_period_end,
        value_saved: price,
        used_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (errUsage || !usage) {
      // rollback do item para nao deixar cobertura sem uso registrado
      await admin.from('comanda_items').delete().eq('id', item.id);
      return { ok: false, error: errUsage?.message ?? 'Erro ao registrar uso' };
    }

    await admin
      .from('comanda_items')
      .update({ subscription_usage_id: usage.id })
      .eq('id', item.id);

    await recalculateTotalDelta(comandaId);

    const usedNow = sub.usedInCycle + 1;
    await notifyCustomer({
      customerId: comanda.customer_id as string,
      type: 'assinatura_uso',
      title: `Assinatura: uso ${usedNow} de ${sub.plan.included_uses}`,
      body: `Seu atendimento de hoje (${service?.name ?? 'serviço'}) foi coberto pela assinatura. Você usou ${usedNow} de ${sub.plan.included_uses} atendimentos deste ciclo.`,
      metadata: { comanda_id: comandaId, subscription_id: sub.id },
    });

    revalidatePath('/admin/comandas');
    return { ok: true, covered: true, usedNow, includedUses: sub.plan.included_uses };
  }

  // -------- Fluxo normal (avulso) --------
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

  await recalculateTotalDelta(comandaId);

  revalidatePath('/admin/comandas');
  return { ok: true };
}

/**
 * Adiciona um produto a comanda. Tambem decrementa stock_current do produto.
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

  const { data: comanda } = await admin
    .from('comandas')
    .select('staff_id')
    .eq('id', comandaId)
    .maybeSingle();

  const staffId = comanda?.staff_id as string | null;
  const totalPrice = price * quantity;
  const productCommission = Number(product?.default_commission_percent ?? 0);
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

  const newStock = Math.max(0, Number(product?.stock_current ?? 0) - quantity);
  await admin
    .from('products')
    .update({ stock_current: newStock })
    .eq('id', productId);

  await recalculateTotalDelta(comandaId);

  revalidatePath('/admin/comandas');
  return { ok: true };
}

/**
 * Remove um item da comanda.
 * - Produto: devolve quantidade ao estoque.
 * - Servico coberto por assinatura: remove tambem o uso do ledger
 *   (somente se ainda nao foi acertado no potinho).
 */
export async function removeComandaItem(
  comandaId: string,
  itemId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _type: 'service' | 'product'
) {
  const admin = createAdminClient();

  const { data: item } = await admin
    .from('comanda_items')
    .select('item_type, product_id, quantity, subscription_usage_id')
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

  // Item coberto por assinatura: estorna o uso (se nao acertado)
  if (item?.subscription_usage_id) {
    await admin
      .from('subscription_usages')
      .delete()
      .eq('id', item.subscription_usage_id)
      .is('settled_payout_id', null);
  }

  const { error } = await admin.from('comanda_items').delete().eq('id', itemId);
  if (error) return { ok: false, error: error.message };

  await recalculateTotalDelta(comandaId);

  revalidatePath('/admin/comandas');
  return { ok: true };
}

/**
 * Versao rapida: recalcula o total sem roundtrip extra.
 */
async function recalculateTotalDelta(comandaId: string) {
  const admin = createAdminClient();
  const { data: items } = await admin.from('comanda_items').select('total_price').eq('comanda_id', comandaId);
  const subtotal = items?.reduce((s, i) => s + Number(i.total_price ?? 0), 0) ?? 0;
  await admin.from('comandas').update({ subtotal, total: subtotal, net_total: subtotal }).eq('id', comandaId);
}

/**
 * Recalcula o total da comanda (soma de comanda_items.total_price).
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

/** Mapeia valores antigos da UI para o enum payment_method do banco. */
function normalizePaymentMethod(method: string): string {
  const map: Record<string, string> = {
    credit_card: 'credit',
    debit_card: 'debit',
  };
  return map[method] ?? method;
}

/**
 * Fecha a comanda (vira venda):
 *  - registra pagamento em comanda_payments
 *  - marca appointment como completed (se houver)
 *  - atualiza estatisticas do cliente
 *  - credita pontos de fidelidade (R$1 = N pontos, config da barbearia)
 */
export async function closeComanda(
  comandaId: string,
  paymentMethod: string,
  discount = 0,
  tip = 0
) {
  const admin = createAdminClient();
  const method = normalizePaymentMethod(paymentMethod);

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
    method,
    amount: total,
    installments: 1,
    fee_percent: 0,
    fee_value: 0,
    net_amount: total,
  });

  if (errPayment) return { ok: false, error: errPayment.message };

  // 3. Integracao: marca appointment como completed se houver
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

  // 4. Atualiza estatisticas do cliente + fidelidade
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
          total_appointments: Number(customer.total_appointments ?? 0) + 1,
          total_spent: Number(customer.total_spent ?? 0) + total,
        })
        .eq('id', comanda.customer_id);
    }

    // Pontos de fidelidade (idempotente por comanda)
    await awardPointsForComanda({
      comandaId,
      customerId: comanda.customer_id as string,
      amount: total,
    });
  }

  revalidatePath('/admin/comandas', 'layout');
  revalidatePath('/admin/agenda');
  return { ok: true };
}

/**
 * Cancela uma comanda aberta.
 * Devolve estoque dos produtos e estorna usos de assinatura nao acertados.
 */
export async function cancelComanda(comandaId: string) {
  const admin = createAdminClient();

  const { data: items } = await admin
    .from('comanda_items')
    .select('item_type, product_id, quantity, subscription_usage_id')
    .eq('comanda_id', comandaId);

  for (const item of items ?? []) {
    if (item.item_type === 'product' && item.product_id) {
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

    if (item.subscription_usage_id) {
      await admin
        .from('subscription_usages')
        .delete()
        .eq('id', item.subscription_usage_id)
        .is('settled_payout_id', null);
    }
  }

  const { error } = await admin
    .from('comandas')
    .update({
      status: 'cancelled',
      closed_at: new Date().toISOString(),
    })
    .eq('id', comandaId);

  if (error) return { ok: false, error: error.message };

  revalidatePath('/admin/comandas', 'layout');
  revalidatePath('/admin/produtos');
  return { ok: true };
}
