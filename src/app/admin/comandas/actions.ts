﻿'use server';

import { createManagerClient } from '@/lib/supabase/manager';
import { revalidatePath } from 'next/cache';
import { getSessionStaff } from '@/lib/staff-auth';
import { getActiveSubscription, isDayAllowed, formatAllowedDays } from '@/lib/subscriptions';
import { awardPointsForComanda } from '@/lib/loyalty';
import { gastarCredito, saldoDeCredito } from '@/lib/creditos-db';
import { quantoOCreditoCobre } from '@/lib/credito-cliente';
import { notifyCustomer } from '@/lib/notifications';

import { lojaAtual } from '@/lib/loja';
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
  const admin = await createManagerClient();
  const barbershopId = await lojaAtual();

  // Se houver appointment, verificar se ja existe comanda vinculada
  if (data.appointment_id) {
    const { data: existing } = await admin
      .from('comandas')
      .select('id, status')
      .eq('appointment_id', data.appointment_id)
      .eq('barbershop_id', barbershopId)
      .in('status', ['open', 'closed'])
      .maybeSingle();

    if (existing) {
      // Ja existe comanda vinculada ao agendamento; reutiliza
      return { ok: true, comanda: existing, reused: true };
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payload: any = {
    barbershop_id: barbershopId,
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
      .eq('barbershop_id', barbershopId)
      .in('status', ['scheduled']);
  }

  revalidatePath('/admin/comandas');
  return { ok: true, comanda: created };
}

/**
 * Inicia o atendimento a partir da Agenda: garante a comanda do agendamento
 * (cria e pre-popula com os servicos, ou reutiliza a existente) e coloca o
 * agendamento em andamento. Idempotente: nunca duplica comanda.
 */
export async function startAppointmentComanda(appointmentId: string) {
  const admin = await createManagerClient();
  const barbershopId = await lojaAtual();

  const { data: appt } = await admin
    .from('appointments')
    .select('id, customer_id, staff_id, status')
    .eq('id', appointmentId)
    .eq('barbershop_id', barbershopId)
    .maybeSingle();

  if (!appt) return { ok: false as const, error: 'Agendamento não encontrado' };

  // Reutiliza comanda ja vinculada ao agendamento, se houver
  const { data: existing } = await admin
    .from('comandas')
    .select('id')
    .eq('appointment_id', appointmentId)
    .eq('barbershop_id', barbershopId)
    .in('status', ['open', 'closed'])
    .maybeSingle();

  let comandaId: string;
  if (existing) {
    comandaId = existing.id as string;
  } else {
    const created = await createComanda({
      customer_id: appt.customer_id as string,
      staff_id: appt.staff_id as string,
      appointment_id: appointmentId,
    });
    if (!created.ok || !created.comanda) {
      return { ok: false as const, error: created.error ?? 'Erro ao abrir comanda' };
    }
    comandaId = (created.comanda as { id: string }).id;
    await populateComandaFromAppointment(comandaId, appointmentId);
  }

  // Garante o status "em andamento" (sem mexer em concluido/cancelado)
  if (appt.status === 'scheduled' || appt.status === 'confirmed') {
    await admin
      .from('appointments')
      .update({ status: 'in_progress' })
      .eq('id', appointmentId)
      .eq('barbershop_id', barbershopId);
  }

  revalidatePath('/admin/agenda');
  revalidatePath('/admin/comandas');
  return { ok: true as const, comandaId };
}

/**
 * Pre-popula a comanda com os servicos que estavam no agendamento.
 */
export async function populateComandaFromAppointment(
  comandaId: string,
  appointmentId: string
) {
  const admin = await createManagerClient();
  const barbershopId = await lojaAtual();

  const { data: apptServices } = await admin
    .from('appointment_services')
    .select('service_id, price, commission_percent')
    .eq('appointment_id', appointmentId)
    .eq('barbershop_id', barbershopId);

  if (!apptServices || apptServices.length === 0) {
    return { ok: true, added: 0 };
  }

  const { data: comanda } = await admin
    .from('comandas')
    .select('staff_id')
    .eq('id', comandaId)
    .eq('barbershop_id', barbershopId)
    .maybeSingle();

  if (!comanda) return { ok: false, error: 'Comanda não pertence a esta unidade.' };

  const staffId = comanda?.staff_id as string | null;

  const serviceIds = apptServices.map((s) => s.service_id);
  const { data: services } = await admin
    .from('services')
    .select('id, name')
    .in('id', serviceIds)
    .eq('barbershop_id', barbershopId);
  const nameMap = new Map(
    (services ?? []).map((s) => [s.id as string, s.name as string])
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const itemsToInsert = apptServices.map((s: any) => ({
    barbershop_id: barbershopId,
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
  const admin = await createManagerClient();
  const barbershopId = await lojaAtual();

  const [{ data: service }, { data: staff }, { data: comanda }] = await Promise.all([
    admin
      .from('services')
      .select('name')
      .eq('id', serviceId)
      .eq('barbershop_id', barbershopId)
      .maybeSingle(),
    admin
      .from('staff')
      .select('default_commission_percent')
      .eq('id', staffId)
      .eq('barbershop_id', barbershopId)
      .maybeSingle(),
    admin
      .from('comandas')
      .select('customer_id, appointment_id, status')
      .eq('id', comandaId)
      .eq('barbershop_id', barbershopId)
      .maybeSingle(),
  ]);

  if (!comanda) return { ok: false, error: 'Comanda não encontrada' };
  if (!service) return { ok: false, error: 'Serviço não pertence a esta unidade' };
  if (!staff) return { ok: false, error: 'Profissional não pertence a esta unidade' };
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
      barbershop_id: barbershopId,
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
        barbershop_id: barbershopId,
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
      await admin
        .from('comanda_items')
        .delete()
        .eq('id', item.id)
        .eq('barbershop_id', barbershopId);
      return { ok: false, error: errUsage?.message ?? 'Erro ao registrar uso' };
    }

    await admin
      .from('comanda_items')
      .update({ subscription_usage_id: usage.id })
      .eq('id', item.id)
      .eq('barbershop_id', barbershopId);

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
    barbershop_id: barbershopId,
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
  const admin = await createManagerClient();
  const barbershopId = await lojaAtual();

  const { data: product } = await admin
    .from('products')
    .select('name, stock_current, default_commission_percent')
    .eq('id', productId)
    .eq('barbershop_id', barbershopId)
    .maybeSingle();

  const { data: comanda } = await admin
    .from('comandas')
    .select('staff_id')
    .eq('id', comandaId)
    .eq('barbershop_id', barbershopId)
    .maybeSingle();

  if (!product) return { ok: false, error: 'Produto não pertence a esta unidade' };
  if (!comanda) return { ok: false, error: 'Comanda não pertence a esta unidade' };

  const staffId = comanda?.staff_id as string | null;
  const totalPrice = price * quantity;
  const productCommission = Number(product?.default_commission_percent ?? 0);
  const commissionValue = (totalPrice * productCommission) / 100;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payload: any = {
    barbershop_id: barbershopId,
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
    .eq('id', productId)
    .eq('barbershop_id', barbershopId);

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
  const admin = await createManagerClient();
  const barbershopId = await lojaAtual();

  const { data: item } = await admin
    .from('comanda_items')
    .select('item_type, product_id, quantity, subscription_usage_id, comanda_id')
    .eq('id', itemId)
    .eq('comanda_id', comandaId)
    .eq('barbershop_id', barbershopId)
    .maybeSingle();

  if (!item) return { ok: false, error: 'Item não pertence a esta comanda.' };

  if (item?.item_type === 'product' && item.product_id) {
    const { data: prod } = await admin
      .from('products')
      .select('stock_current')
      .eq('id', item.product_id)
      .eq('barbershop_id', barbershopId)
      .maybeSingle();
    const newStock =
      Number(prod?.stock_current ?? 0) + Number(item.quantity ?? 0);
    await admin
      .from('products')
      .update({ stock_current: newStock })
      .eq('id', item.product_id)
      .eq('barbershop_id', barbershopId);
  }

  // Item coberto por assinatura: estorna o uso (se nao acertado)
  if (item?.subscription_usage_id) {
    await admin
      .from('subscription_usages')
      .delete()
      .eq('id', item.subscription_usage_id)
      .eq('barbershop_id', barbershopId)
      .is('settled_payout_id', null);
  }

  const { error } = await admin
    .from('comanda_items')
    .delete()
    .eq('id', itemId)
    .eq('comanda_id', comandaId)
    .eq('barbershop_id', barbershopId);
  if (error) return { ok: false, error: error.message };

  await recalculateTotalDelta(comandaId);

  revalidatePath('/admin/comandas');
  return { ok: true };
}

/**
 * Versao rapida: recalcula o total sem roundtrip extra.
 */
async function recalculateTotalDelta(comandaId: string) {
  const admin = await createManagerClient();
  const barbershopId = await lojaAtual();
  const { data: items } = await admin
    .from('comanda_items')
    .select('total_price')
    .eq('comanda_id', comandaId)
    .eq('barbershop_id', barbershopId);
  const subtotal = items?.reduce((s, i) => s + Number(i.total_price ?? 0), 0) ?? 0;
  await admin
    .from('comandas')
    .update({ subtotal, total: subtotal, net_total: subtotal })
    .eq('id', comandaId)
    .eq('barbershop_id', barbershopId);
}

/**
 * Recalcula o total da comanda (soma de comanda_items.total_price).
 */
async function recalculateComandaTotal(comandaId: string) {
  const admin = await createManagerClient();
  const barbershopId = await lojaAtual();

  const { data: items } = await admin
    .from('comanda_items')
    .select('total_price')
    .eq('comanda_id', comandaId)
    .eq('barbershop_id', barbershopId);

  const subtotal =
    items?.reduce((sum, i) => sum + Number(i.total_price), 0) ?? 0;

  await admin
    .from('comandas')
    .update({
      subtotal,
      total: subtotal,
      net_total: subtotal,
    })
    .eq('id', comandaId)
    .eq('barbershop_id', barbershopId);
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
  tip = 0,
  /**
   * Como o cliente paga o que o crédito não cobre (produto e gorjeta).
   * Só faz sentido quando paymentMethod é 'store_credit'.
   */
  metodoDoResto?: string
) {
  const admin = await createManagerClient();
  const barbershopId = await lojaAtual();
  const method = normalizePaymentMethod(paymentMethod);

  const { data: comanda } = await admin
    .from('comandas')
    .select('subtotal, appointment_id, customer_id, total, status')
    .eq('id', comandaId)
    .eq('barbershop_id', barbershopId)
    .maybeSingle();

  if (!comanda) return { ok: false, error: 'Comanda não encontrada' };
  if (comanda.status !== 'open') {
    return { ok: false, error: 'Esta comanda já foi fechada ou cancelada.' };
  }

  const subtotal = Number(comanda.subtotal);
  const safeDiscount = Math.max(0, Number(discount) || 0);
  const safeTip = Math.max(0, Number(tip) || 0);

  // Integridade financeira: o desconto nunca pode exceder o subtotal
  // e o total liquido nunca pode ser negativo.
  if (safeDiscount > subtotal) {
    return {
      ok: false,
      error: 'O desconto não pode ser maior que o subtotal da comanda.',
    };
  }

  const total = subtotal - safeDiscount + safeTip;

  if (total < 0) {
    return { ok: false, error: 'O total da comanda não pode ser negativo.' };
  }

  const discountPct =
    safeDiscount > 0 && subtotal > 0 ? (safeDiscount / subtotal) * 100 : 0;

  // Taxa de cartao por metodo (credito x debito), aplicada ao total cobrado.
  const { data: feeCfg } = await admin
    .from('barbershops')
    .select('credit_fee_percent, debit_fee_percent')
    .eq('id', barbershopId)
    .maybeSingle();

  function taxaDoMetodo(m: string) {
    let p = 0;
    if (m === 'credit') p = Number(feeCfg?.credit_fee_percent ?? 0);
    else if (m === 'debit') p = Number(feeCfg?.debit_fee_percent ?? 0);
    return p > 0 ? p : 0;
  }

  // Pagamento com credito da casa.
  //
  // O credito paga servico; produto e gorjeta o cliente paga como qualquer
  // outro. Por isso o fechamento pode virar dois pagamentos: um de credito e
  // um do resto. O quanto o credito cobre e calculado aqui no servidor, a
  // partir dos itens da propria comanda: o navegador nao decide isso.
  let creditoUsado = 0;
  let restante = total;
  let metodoDoRestante = method;

  if (method === 'store_credit') {
    if (!comanda.customer_id) {
      return { ok: false, error: 'Comanda sem cliente não pode ser paga com crédito.' };
    }

    const { data: itens } = await admin
      .from('comanda_items')
      .select('item_type, total_price')
      .eq('comanda_id', comandaId)
      .eq('barbershop_id', barbershopId);

    const valorServicos = (itens ?? [])
      .filter((i) => i.item_type === 'service')
      .reduce((s, i) => s + Number(i.total_price ?? 0), 0);

    if (valorServicos <= 0) {
      return {
        ok: false,
        error: 'O crédito paga só serviço. Esta comanda não tem serviço nenhum.',
      };
    }

    const saldo = await saldoDeCredito(comanda.customer_id as string);
    creditoUsado = quantoOCreditoCobre({
      valorServicos,
      subtotal,
      desconto: safeDiscount,
      saldo,
    });

    if (creditoUsado <= 0) {
      return { ok: false, error: 'Este cliente não tem crédito disponível para usar hoje.' };
    }

    restante = Number((total - creditoUsado).toFixed(2));

    if (restante > 0.009) {
      metodoDoRestante = normalizePaymentMethod(metodoDoResto ?? '');
      if (!metodoDoRestante || metodoDoRestante === 'store_credit') {
        return {
          ok: false,
          error: `O crédito cobre R$ ${creditoUsado.toFixed(2)}. Escolha como o cliente paga os R$ ${restante.toFixed(2)} restantes.`,
        };
      }
    } else {
      restante = 0;
    }

    const baixa = await gastarCredito({
      customerId: comanda.customer_id as string,
      comandaId,
      valor: creditoUsado,
    });
    if (!baixa.ok) return { ok: false, error: baixa.error };
  }

  // A taxa de cartao so incide sobre o que passou na maquininha
  const feePercent = restante > 0 ? taxaDoMetodo(metodoDoRestante) : 0;
  const feeValue = Math.round(restante * feePercent) / 100;
  const netTotal = total - feeValue;

  // 1. Atualiza comanda para closed
  const { error: errUpdate } = await admin
    .from('comandas')
    .update({
      status: 'closed',
      discount_type: 'percentage',
      discount_value: discountPct,
      total,
      card_fee_total: feeValue,
      net_total: netTotal,
      closed_at: new Date().toISOString(),
    })
    .eq('id', comandaId)
    .eq('barbershop_id', barbershopId);

  if (errUpdate) return { ok: false, error: errUpdate.message };

  // 2-3. Pagamento + atualizar appointment em paralelo (independentes entre si)
  //
  // Cada forma de pagamento vira uma linha. Quase sempre e uma so; com credito
  // podem ser duas, e e isso que deixa o financeiro separar depois o que foi
  // dinheiro de verdade do que foi abatido do credito.
  const pagamentos =
    creditoUsado > 0
      ? [
          {
            barbershop_id: barbershopId,
            comanda_id: comandaId,
            method: 'store_credit',
            amount: creditoUsado,
            installments: 1,
            fee_percent: 0,
            fee_value: 0,
            net_amount: creditoUsado,
          },
          ...(restante > 0
            ? [
                {
                  barbershop_id: barbershopId,
                  comanda_id: comandaId,
                  method: metodoDoRestante,
                  amount: restante,
                  installments: 1,
                  fee_percent: feePercent,
                  fee_value: feeValue,
                  net_amount: Number((restante - feeValue).toFixed(2)),
                },
              ]
            : []),
        ]
      : [
          {
            barbershop_id: barbershopId,
            comanda_id: comandaId,
            method,
            amount: total,
            installments: 1,
            fee_percent: feePercent,
            fee_value: feeValue,
            net_amount: netTotal,
          },
        ];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parallelOps: any[] = [
    admin.from('comanda_payments').insert(pagamentos),
  ];

  if (comanda.appointment_id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    parallelOps.push(
      admin.from('appointments').update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        comanda_id: comandaId,
      })
        .eq('id', comanda.appointment_id)
        .eq('barbershop_id', barbershopId)
    );
  }

  const parallelResults = await Promise.all(parallelOps);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const paymentResult = parallelResults[0] as any;
  if (paymentResult?.error) return { ok: false, error: paymentResult.error.message };

  // 4. Cliente + pontos em paralelo
  if (comanda.customer_id) {
    const { data: customer } = await admin
      .from('customers')
      .select('total_appointments, total_spent')
      .eq('id', comanda.customer_id)
      .eq('barbershop_id', barbershopId)
      .maybeSingle();

    // Visita conta sempre; valor gasto so o que saiu do bolso do cliente. O que
    // foi abatido do credito nao pode empurrar ninguem para o topo do ranking
    // de VIP com um dinheiro que a barbearia nunca recebeu.
    const saiuDoBolso = Number((total - creditoUsado).toFixed(2));

    await Promise.all([
      customer
        ? admin.from('customers').update({
            total_appointments: Number(customer.total_appointments ?? 0) + 1,
            total_spent: Number(customer.total_spent ?? 0) + saiuDoBolso,
          })
            .eq('id', comanda.customer_id)
            .eq('barbershop_id', barbershopId)
        : Promise.resolve(),
      awardPointsForComanda({
        comandaId,
        customerId: comanda.customer_id as string,
        amount: total,
      }),
    ]);
  }

  revalidatePath('/admin/comandas');
  revalidatePath('/admin/agenda');
  return { ok: true };
}

/**
 * Cancela uma comanda aberta.
 * Devolve estoque dos produtos e estorna usos de assinatura nao acertados.
 */
export async function cancelComanda(comandaId: string) {
  const admin = await createManagerClient();
  const barbershopId = await lojaAtual();

  const { data: comanda } = await admin
    .from('comandas')
    .select('id')
    .eq('id', comandaId)
    .eq('barbershop_id', barbershopId)
    .maybeSingle();
  if (!comanda) return { ok: false, error: 'Comanda não pertence a esta unidade.' };

  const { data: items } = await admin
    .from('comanda_items')
    .select('item_type, product_id, quantity, subscription_usage_id')
    .eq('comanda_id', comandaId)
    .eq('barbershop_id', barbershopId);

  // Coletar IDs de produto e usages para processar em paralelo
  const productItems = (items ?? []).filter(
    (i) => i.item_type === 'product' && i.product_id
  );
  const usageIds = (items ?? [])
    .map((i) => i.subscription_usage_id)
    .filter(Boolean) as string[];

  // Buscar estoques de todos os produtos de uma vez
  const productOps: Promise<unknown>[] = [];
  if (productItems.length > 0) {
    const pids = productItems.map((i) => i.product_id as string);
    const { data: prods } = await admin
      .from('products')
      .select('id, stock_current')
      .in('id', pids)
      .eq('barbershop_id', barbershopId);
    const stockMap = new Map((prods ?? []).map((p) => [p.id, Number(p.stock_current ?? 0)]));
    for (const item of productItems) {
      const current = stockMap.get(item.product_id as string) ?? 0;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      productOps.push(
        admin.from('products')
          .update({ stock_current: current + Number(item.quantity ?? 0) })
          .eq('id', item.product_id as string)
          .eq('barbershop_id', barbershopId) as any
      );
    }
  }

  // Todos os updates em paralelo
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cancelOps: any[] = [...productOps];
  if (usageIds.length > 0) {
    cancelOps.push(
      admin.from('subscription_usages')
        .delete()
        .in('id', usageIds)
        .eq('barbershop_id', barbershopId)
        .is('settled_payout_id', null) as any
    );
  }
  if (cancelOps.length > 0) await Promise.all(cancelOps);

  const { error } = await admin
    .from('comandas')
    .update({
      status: 'cancelled',
      closed_at: new Date().toISOString(),
    })
    .eq('id', comandaId)
    .eq('barbershop_id', barbershopId);

  if (error) return { ok: false, error: error.message };

  revalidatePath('/admin/comandas');
  return { ok: true };
}

// =============================================================================
// CORRIGIR COMANDA FECHADA (gestao)
// =============================================================================

/**
 * Reabre uma comanda fechada para correcao.
 * A gestao nao tem limite de tempo: quem tem limite e o barbeiro, no painel.
 */
export async function reabrirComanda(comandaId: string) {
  const admin = await createManagerClient();
  const gestor = await getSessionStaff();

  const { error } = await admin.rpc('reabrir_comanda', {
    p_comanda_id: comandaId,
    p_staff_id: null,
    p_ator: gestor?.profileId ?? null,
    p_janela_minutos: 60,
  });

  if (error) {
    const msg = error.message ?? '';
    if (/NAO_ESTA_FECHADA/.test(msg)) {
      return { ok: false, error: 'Esta comanda não está fechada.' };
    }
    if (/NAO_ENCONTRADA/.test(msg)) return { ok: false, error: 'Comanda não encontrada.' };
    return { ok: false, error: msg || 'Não foi possível reabrir a comanda.' };
  }

  revalidatePath('/admin/comandas');
  revalidatePath(`/admin/comandas/${comandaId}`);
  revalidatePath('/admin/financeiro');
  return { ok: true };
}

/**
 * Estorna uma comanda fechada.
 *
 * Nada e apagado: a comanda sai do faturamento, mas continua existindo com
 * motivo e autor. Excluir movimento e o que faz o caixa nao bater sem
 * ninguem conseguir explicar depois.
 *
 * O estorno devolve produto ao estoque, devolve o uso da assinatura ao ciclo
 * do cliente, tira os pontos de fidelidade, desfaz o pagamento e volta o
 * atendimento para confirmado.
 */
export async function estornarComanda(comandaId: string, motivo: string) {
  const texto = (motivo ?? '').trim();
  if (texto.length < 3) {
    return { ok: false, error: 'Escreva o motivo do estorno.' };
  }
  if (texto.length > 300) {
    return { ok: false, error: 'Motivo muito longo. Resuma em até 300 caracteres.' };
  }

  const admin = await createManagerClient();
  const gestor = await getSessionStaff();

  const { error } = await admin.rpc('estornar_comanda', {
    p_comanda_id: comandaId,
    p_ator: gestor?.profileId ?? null,
    p_motivo: texto,
  });

  if (error) {
    const msg = error.message ?? '';
    if (/MOTIVO_OBRIGATORIO/.test(msg)) {
      return { ok: false, error: 'Escreva o motivo do estorno.' };
    }
    if (/NAO_ESTA_FECHADA/.test(msg)) {
      return { ok: false, error: 'Só dá para estornar comanda fechada.' };
    }
    if (/NAO_ENCONTRADA/.test(msg)) return { ok: false, error: 'Comanda não encontrada.' };
    return { ok: false, error: msg || 'Não foi possível estornar a comanda.' };
  }

  revalidatePath('/admin/comandas');
  revalidatePath(`/admin/comandas/${comandaId}`);
  revalidatePath('/admin/financeiro');
  revalidatePath('/admin/dre');
  return { ok: true };
}
