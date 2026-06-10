'use server';

/**
 * Assinaturas (Clube) — reescrito 10/06/2026 para o modelo normalizado.
 *
 * ANTES: o codigo gravava em colunas inexistentes (billing_cycle,
 * includes_count...) e usava customer_subscriptions. NUNCA funcionou em prod.
 * AGORA: usa subscription_plans (period, allowed_days, included_uses,
 * barber_share_percent) + subscriptions + subscription_usages +
 * subscription_payments + subscription_payouts.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';
import {
  addBillingPeriod,
  nextCycle,
  splitPool,
  toCents,
  centsToBRL,
  formatAllowedDays,
} from '@/lib/subscriptions';
import { notifyCustomer } from '@/lib/notifications';

const BARBERSHOP_ID = '11111111-1111-1111-1111-111111111111';

function nullIfEmpty(v?: string | null) {
  if (!v) return null;
  const t = v.trim();
  return t.length === 0 ? null : t;
}

function fmtBR(d: Date) {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
}

// =============================================================================
// PLANOS
// =============================================================================

export interface PlanFormData {
  name: string;
  description?: string | null;
  price: number;
  period?: string; // billing_period enum: monthly|quarterly|semiannual|annual
  allowed_days?: number[]; // 0=Dom..6=Sáb
  included_uses?: number;
  barber_share_percent?: number;
  accumulate_unused?: boolean;
  show_on_public_menu?: boolean;
  active?: boolean;
  display_order?: number;
}

export async function createPlan(data: PlanFormData) {
  const admin = createAdminClient();

  const { error } = await admin.from('subscription_plans').insert({
    barbershop_id: BARBERSHOP_ID,
    name: data.name,
    description: nullIfEmpty(data.description),
    price: data.price,
    period: data.period ?? 'monthly',
    allowed_days: data.allowed_days ?? [1, 2, 3, 4, 5, 6],
    included_uses: data.included_uses ?? 4,
    barber_share_percent: data.barber_share_percent ?? 50,
    accumulate_unused: data.accumulate_unused ?? false,
    show_on_public_menu: data.show_on_public_menu ?? true,
    active: data.active ?? true,
    display_order: data.display_order ?? 0,
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath('/admin/assinaturas');
  return { ok: true };
}

export async function updatePlan(planId: string, data: PlanFormData) {
  const admin = createAdminClient();

  const { error } = await admin
    .from('subscription_plans')
    .update({
      name: data.name,
      description: nullIfEmpty(data.description),
      price: data.price,
      period: data.period ?? 'monthly',
      allowed_days: data.allowed_days ?? [1, 2, 3, 4, 5, 6],
      included_uses: data.included_uses ?? 4,
      barber_share_percent: data.barber_share_percent ?? 50,
      accumulate_unused: data.accumulate_unused ?? false,
      show_on_public_menu: data.show_on_public_menu ?? true,
      active: data.active ?? true,
      display_order: data.display_order ?? 0,
    })
    .eq('id', planId);

  if (error) return { ok: false, error: error.message };

  revalidatePath('/admin/assinaturas');
  revalidatePath(`/admin/assinaturas/planos/${planId}`);
  return { ok: true };
}

export async function deletePlan(planId: string) {
  const admin = createAdminClient();
  // Soft delete: preserva historico de assinaturas
  const { error } = await admin
    .from('subscription_plans')
    .update({ active: false })
    .eq('id', planId);

  if (error) return { ok: false, error: error.message };

  revalidatePath('/admin/assinaturas');
  return { ok: true };
}

// =============================================================================
// ASSINATURAS
// =============================================================================

export interface CreateSubscriptionInput {
  customer_id: string;
  plan_id: string;
  /** Lanca o primeiro pagamento ja na criacao (default true) */
  charge_now?: boolean;
  payment_method?: string; // cash|pix|debit|credit
  notes?: string | null;
}

export async function createSubscription(input: CreateSubscriptionInput) {
  const admin = createAdminClient();

  const { data: plan } = await admin
    .from('subscription_plans')
    .select('*')
    .eq('id', input.plan_id)
    .maybeSingle();
  if (!plan) return { ok: false, error: 'Plano não encontrado' };

  // Evita assinatura duplicada ativa
  const { data: existing } = await admin
    .from('subscriptions')
    .select('id')
    .eq('customer_id', input.customer_id)
    .in('status', ['active', 'past_due'])
    .limit(1);
  if (existing && existing.length > 0) {
    return { ok: false, error: 'Este cliente já tem uma assinatura ativa' };
  }

  const now = new Date();
  const periodEnd = addBillingPeriod(now, plan.period as string);

  const { data: sub, error } = await admin
    .from('subscriptions')
    .insert({
      barbershop_id: BARBERSHOP_ID,
      customer_id: input.customer_id,
      plan_id: input.plan_id,
      status: 'active',
      started_at: now.toISOString(),
      current_period_start: now.toISOString(),
      current_period_end: periodEnd.toISOString(),
      next_billing_at: periodEnd.toISOString(),
      current_price: Number(plan.price),
      notes: nullIfEmpty(input.notes),
    })
    .select('id')
    .single();

  if (error || !sub) return { ok: false, error: error?.message ?? 'Erro ao criar' };

  const { data: customer } = await admin
    .from('customers')
    .select('full_name')
    .eq('id', input.customer_id)
    .maybeSingle();

  // Primeiro pagamento (sem rateio: nao existe ciclo anterior)
  if (input.charge_now !== false) {
    const method = input.payment_method ?? 'pix';

    const { data: tx } = await admin
      .from('transactions')
      .insert({
        barbershop_id: BARBERSHOP_ID,
        type: 'subscription',
        amount: Number(plan.price),
        description: `Assinatura ${plan.name} - ${customer?.full_name ?? 'Cliente'}`,
        category: 'Assinaturas',
        customer_id: input.customer_id,
        payment_method: method,
        occurred_at: now.toISOString(),
      })
      .select('id')
      .single();

    await admin.from('subscription_payments').insert({
      barbershop_id: BARBERSHOP_ID,
      subscription_id: sub.id,
      amount: Number(plan.price),
      method,
      status: 'approved',
      period_start: now.toISOString(),
      period_end: periodEnd.toISOString(),
      paid_at: now.toISOString(),
      transaction_id: tx?.id ?? null,
    });

    await admin
      .from('subscriptions')
      .update({ last_billing_status: 'approved', last_billing_at: now.toISOString() })
      .eq('id', sub.id);
  }

  await notifyCustomer({
    customerId: input.customer_id,
    type: 'assinatura_criada',
    title: 'Bem-vindo ao Clube! 💈',
    body: `Sua assinatura ${plan.name} está ativa! Você tem ${plan.included_uses} atendimentos até ${fmtBR(periodEnd)} (dias do plano: ${formatAllowedDays(plan.allowed_days as number[])}).`,
  });

  revalidatePath('/admin/assinaturas');
  return { ok: true, subscriptionId: sub.id };
}

export async function cancelSubscription(subscriptionId: string, reason?: string) {
  const admin = createAdminClient();

  const { error } = await admin
    .from('subscriptions')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancellation_reason: nullIfEmpty(reason) ?? null,
    })
    .eq('id', subscriptionId);

  if (error) return { ok: false, error: error.message };

  revalidatePath('/admin/assinaturas');
  return { ok: true };
}

export async function reactivateSubscription(subscriptionId: string) {
  const admin = createAdminClient();

  const { error } = await admin
    .from('subscriptions')
    .update({ status: 'active', cancelled_at: null, cancellation_reason: null })
    .eq('id', subscriptionId);

  if (error) return { ok: false, error: error.message };

  revalidatePath('/admin/assinaturas');
  return { ok: true };
}

// =============================================================================
// PAGAMENTO + FECHAMENTO DE CICLO (potinho)
// =============================================================================

export interface SettlementPreview {
  ok: boolean;
  error?: string;
  customerName?: string;
  planName?: string;
  price?: number;
  sharePercent?: number;
  poolAmount?: number;
  totalUses?: number;
  items?: Array<{ staff_id: string; staff_name: string; uses: number; amount: number }>;
  newPeriodEnd?: string;
}

/**
 * Previa do fechamento: mostra o rateio do potinho ANTES de confirmar
 * o pagamento (modal "Lançar pagamento").
 */
export async function previewSettlement(subscriptionId: string): Promise<SettlementPreview> {
  const admin = createAdminClient();

  const { data: sub } = await admin
    .from('subscriptions')
    .select(
      `id, current_period_end, current_price, customer_id,
       plan:subscription_plans (name, price, period, barber_share_percent),
       customer:customers (full_name)`
    )
    .eq('id', subscriptionId)
    .maybeSingle();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const s = sub as any;
  if (!s || !s.plan) return { ok: false, error: 'Assinatura não encontrada' };

  const { data: usages } = await admin
    .from('subscription_usages')
    .select('staff_id, staff:staff(display_name)')
    .eq('subscription_id', subscriptionId)
    .is('settled_payout_id', null);

  const byStaff = new Map<string, { name: string; uses: number }>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const u of (usages ?? []) as any[]) {
    if (!u.staff_id) continue;
    const cur = byStaff.get(u.staff_id) ?? {
      name: u.staff?.display_name ?? 'Profissional',
      uses: 0,
    };
    cur.uses += 1;
    byStaff.set(u.staff_id, cur);
  }

  const price = Number(s.current_price ?? s.plan.price);
  const sharePercent = Number(s.plan.barber_share_percent ?? 50);
  const poolCents = Math.round(toCents(price) * (sharePercent / 100));

  const split = splitPool(
    poolCents,
    Array.from(byStaff.entries()).map(([staff_id, v]) => ({ staff_id, uses: v.uses }))
  );

  const cycle = nextCycle(new Date(s.current_period_end), s.plan.period as string);

  return {
    ok: true,
    customerName: s.customer?.full_name ?? 'Cliente',
    planName: s.plan.name,
    price,
    sharePercent,
    poolAmount: centsToBRL(poolCents),
    totalUses: (usages ?? []).length,
    items: split.map((i) => ({
      staff_id: i.staff_id,
      staff_name: byStaff.get(i.staff_id)?.name ?? 'Profissional',
      uses: i.uses,
      amount: centsToBRL(i.amountCents),
    })),
    newPeriodEnd: cycle.end.toISOString(),
  };
}

/**
 * Lanca o pagamento da assinatura de UM cliente:
 *  1. Fecha o ciclo anterior: rateia o potinho entre os barbeiros que
 *     atenderam (proporcional aos usos) e registra repasse + despesas.
 *     Ciclo sem visitas: potinho inteiro fica como receita da barbearia.
 *  2. Registra o pagamento (receita) ancorado no vencimento.
 *  3. Reseta os usos SOMENTE deste cliente (novo ciclo).
 *  4. Notifica o cliente (painel + fila WhatsApp).
 */
export async function registerSubscriptionPayment(
  subscriptionId: string,
  paymentMethod: string
) {
  const admin = createAdminClient();
  const now = new Date();

  const { data: subRaw } = await admin
    .from('subscriptions')
    .select(
      `id, status, customer_id, current_period_start, current_period_end, current_price,
       plan:subscription_plans (id, name, price, period, included_uses, barber_share_percent),
       customer:customers (full_name)`
    )
    .eq('id', subscriptionId)
    .maybeSingle();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sub = subRaw as any;
  if (!sub || !sub.plan) return { ok: false, error: 'Assinatura não encontrada' };
  if (sub.status === 'cancelled') {
    return { ok: false, error: 'Assinatura cancelada. Reative antes de lançar pagamento.' };
  }

  const customerName = sub.customer?.full_name ?? 'Cliente';
  const price = Number(sub.current_price ?? sub.plan.price);
  const sharePercent = Number(sub.plan.barber_share_percent ?? 50);
  const poolCents = Math.round(toCents(price) * (sharePercent / 100));

  // ---- 1. Fechamento do ciclo anterior (usos nao acertados) ----
  const { data: usages } = await admin
    .from('subscription_usages')
    .select('id, staff_id, staff:staff(display_name)')
    .eq('subscription_id', subscriptionId)
    .is('settled_payout_id', null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const usageRows = (usages ?? []) as any[];
  const byStaff = new Map<string, { name: string; uses: number }>();
  for (const u of usageRows) {
    if (!u.staff_id) continue;
    const cur = byStaff.get(u.staff_id) ?? {
      name: u.staff?.display_name ?? 'Profissional',
      uses: 0,
    };
    cur.uses += 1;
    byStaff.set(u.staff_id, cur);
  }

  let payoutId: string | null = null;
  const payoutSummary: Array<{ staff_name: string; uses: number; amount: number }> = [];

  if (usageRows.length > 0 && poolCents > 0) {
    const split = splitPool(
      poolCents,
      Array.from(byStaff.entries()).map(([staff_id, v]) => ({ staff_id, uses: v.uses }))
    );

    const { data: payout, error: errPayout } = await admin
      .from('subscription_payouts')
      .insert({
        barbershop_id: BARBERSHOP_ID,
        subscription_id: subscriptionId,
        period_start: sub.current_period_start,
        period_end: sub.current_period_end,
        plan_price: price,
        barber_share_percent: sharePercent,
        pool_amount: centsToBRL(poolCents),
        total_uses: usageRows.length,
      })
      .select('id')
      .single();

    if (errPayout || !payout) {
      return { ok: false, error: errPayout?.message ?? 'Erro ao fechar o ciclo' };
    }
    payoutId = payout.id;

    for (const item of split) {
      const staffName = byStaff.get(item.staff_id)?.name ?? 'Profissional';
      const amount = centsToBRL(item.amountCents);

      // Despesa de comissao por barbeiro (entra no financeiro/DRE)
      const { data: tx } = await admin
        .from('transactions')
        .insert({
          barbershop_id: BARBERSHOP_ID,
          type: 'commission',
          amount,
          description: `Repasse assinatura ${customerName} (${item.uses}x) - ${staffName}`,
          category: 'Comissão Assinatura',
          customer_id: sub.customer_id,
          staff_id: item.staff_id,
          occurred_at: now.toISOString(),
        })
        .select('id')
        .single();

      await admin.from('subscription_payout_items').insert({
        barbershop_id: BARBERSHOP_ID,
        payout_id: payoutId,
        staff_id: item.staff_id,
        uses_count: item.uses,
        amount,
        transaction_id: tx?.id ?? null,
      });

      payoutSummary.push({ staff_name: staffName, uses: item.uses, amount });
    }

    // Marca usos como acertados (reset individual)
    await admin
      .from('subscription_usages')
      .update({ settled_payout_id: payoutId })
      .eq('subscription_id', subscriptionId)
      .is('settled_payout_id', null);
  }

  // ---- 2. Pagamento (receita) + novo ciclo ancorado no vencimento ----
  const cycle = nextCycle(new Date(sub.current_period_end), sub.plan.period as string, now);

  const { data: incomeTx } = await admin
    .from('transactions')
    .insert({
      barbershop_id: BARBERSHOP_ID,
      type: 'subscription',
      amount: price,
      description: `Assinatura ${sub.plan.name} - ${customerName}`,
      category: 'Assinaturas',
      customer_id: sub.customer_id,
      payment_method: paymentMethod,
      occurred_at: now.toISOString(),
    })
    .select('id')
    .single();

  const { data: payment, error: errPay } = await admin
    .from('subscription_payments')
    .insert({
      barbershop_id: BARBERSHOP_ID,
      subscription_id: subscriptionId,
      amount: price,
      method: paymentMethod,
      status: 'approved',
      period_start: cycle.start.toISOString(),
      period_end: cycle.end.toISOString(),
      paid_at: now.toISOString(),
      transaction_id: incomeTx?.id ?? null,
    })
    .select('id')
    .single();

  if (errPay) return { ok: false, error: errPay.message };

  if (payoutId && payment) {
    await admin
      .from('subscription_payouts')
      .update({ subscription_payment_id: payment.id })
      .eq('id', payoutId);
  }

  // ---- 3. Reset do ciclo (so deste cliente) ----
  const { error: errSub } = await admin
    .from('subscriptions')
    .update({
      status: 'active',
      current_period_start: cycle.start.toISOString(),
      current_period_end: cycle.end.toISOString(),
      next_billing_at: cycle.end.toISOString(),
      last_billing_status: 'approved',
      last_billing_at: now.toISOString(),
      past_due_count: 0,
    })
    .eq('id', subscriptionId);

  if (errSub) return { ok: false, error: errSub.message };

  // ---- 4. Notificacao ----
  await notifyCustomer({
    customerId: sub.customer_id,
    type: 'assinatura_pagamento',
    title: 'Pagamento confirmado! ✅',
    body: `Sua assinatura ${sub.plan.name} foi renovada. Você tem ${sub.plan.included_uses} atendimentos até ${fmtBR(cycle.end)}. Aproveite!`,
    metadata: { subscription_id: subscriptionId },
  });

  revalidatePath('/admin/assinaturas');
  revalidatePath('/admin/financeiro');
  revalidatePath('/admin');

  return {
    ok: true,
    payout: payoutSummary,
    poolAmount: centsToBRL(poolCents),
    totalUses: usageRows.length,
    newPeriodEnd: cycle.end.toISOString(),
  };
}
