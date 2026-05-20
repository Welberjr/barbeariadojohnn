'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';

const BARBERSHOP_ID = '11111111-1111-1111-1111-111111111111';

// =============================================================================
// PLANOS DE ASSINATURA
// =============================================================================

export interface PlanFormData {
  name: string;
  description?: string | null;
  price: number;
  billing_cycle?: string;
  includes_services?: string[]; // array de service_ids
  includes_count?: number;
  discount_percent_on_extras?: number;
  active?: boolean;
  display_order?: number;
}

function nullIfEmpty(v?: string | null) {
  if (!v) return null;
  const t = v.trim();
  return t.length === 0 ? null : t;
}

export async function createPlan(data: PlanFormData) {
  const admin = createAdminClient();

  const { error } = await admin.from('subscription_plans').insert({
    barbershop_id: BARBERSHOP_ID,
    name: data.name,
    description: nullIfEmpty(data.description),
    price: data.price,
    billing_cycle: data.billing_cycle ?? 'monthly',
    includes_services: data.includes_services ?? [],
    includes_count: data.includes_count ?? 0,
    discount_percent_on_extras: data.discount_percent_on_extras ?? 0,
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
      billing_cycle: data.billing_cycle ?? 'monthly',
      includes_services: data.includes_services ?? [],
      includes_count: data.includes_count ?? 0,
      discount_percent_on_extras: data.discount_percent_on_extras ?? 0,
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

  // Soft delete: desativa (não exclui para preservar histórico de assinaturas)
  const { error } = await admin
    .from('subscription_plans')
    .update({ active: false })
    .eq('id', planId);

  if (error) return { ok: false, error: error.message };

  revalidatePath('/admin/assinaturas');
  return { ok: true };
}

// =============================================================================
// ASSINATURAS DE CLIENTES
// =============================================================================

export interface SubscriptionFormData {
  customer_id: string;
  plan_id: string;
  notes?: string | null;
}

export async function createSubscription(data: SubscriptionFormData) {
  const admin = createAdminClient();

  // Buscar plano pra pegar billing_cycle e includes_count
  const { data: plan } = await admin
    .from('subscription_plans')
    .select('billing_cycle, includes_count')
    .eq('id', data.plan_id)
    .maybeSingle();

  if (!plan) return { ok: false, error: 'Plano não encontrado' };

  const now = new Date();
  const periodEnd = new Date(now);
  if (plan.billing_cycle === 'monthly') {
    periodEnd.setMonth(periodEnd.getMonth() + 1);
  } else if (plan.billing_cycle === 'weekly') {
    periodEnd.setDate(periodEnd.getDate() + 7);
  } else if (plan.billing_cycle === 'yearly') {
    periodEnd.setFullYear(periodEnd.getFullYear() + 1);
  } else {
    periodEnd.setMonth(periodEnd.getMonth() + 1);
  }

  const { error } = await admin.from('customer_subscriptions').insert({
    barbershop_id: BARBERSHOP_ID,
    customer_id: data.customer_id,
    plan_id: data.plan_id,
    status: 'active',
    started_at: now.toISOString(),
    current_period_start: now.toISOString(),
    current_period_end: periodEnd.toISOString(),
    remaining_uses: Number(plan.includes_count ?? 0),
    notes: nullIfEmpty(data.notes),
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath('/admin/assinaturas');
  return { ok: true };
}

export async function cancelSubscription(subscriptionId: string) {
  const admin = createAdminClient();

  const { error } = await admin
    .from('customer_subscriptions')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
    })
    .eq('id', subscriptionId);

  if (error) return { ok: false, error: error.message };

  revalidatePath('/admin/assinaturas');
  return { ok: true };
}

export async function reactivateSubscription(subscriptionId: string) {
  const admin = createAdminClient();

  const { error } = await admin
    .from('customer_subscriptions')
    .update({
      status: 'active',
      cancelled_at: null,
    })
    .eq('id', subscriptionId);

  if (error) return { ok: false, error: error.message };

  revalidatePath('/admin/assinaturas');
  return { ok: true };
}

/**
 * Renova a assinatura para o próximo ciclo manualmente.
 */
export async function renewSubscription(subscriptionId: string) {
  const admin = createAdminClient();

  const { data: sub } = await admin
    .from('customer_subscriptions')
    .select('plan_id, current_period_end')
    .eq('id', subscriptionId)
    .maybeSingle();

  if (!sub) return { ok: false, error: 'Assinatura não encontrada' };

  const { data: plan } = await admin
    .from('subscription_plans')
    .select('billing_cycle, includes_count')
    .eq('id', sub.plan_id as string)
    .maybeSingle();

  if (!plan) return { ok: false, error: 'Plano não encontrado' };

  // Próximo período começa do fim do atual
  const periodStart = new Date(sub.current_period_end as string);
  const periodEnd = new Date(periodStart);
  if (plan.billing_cycle === 'monthly') {
    periodEnd.setMonth(periodEnd.getMonth() + 1);
  } else if (plan.billing_cycle === 'weekly') {
    periodEnd.setDate(periodEnd.getDate() + 7);
  } else if (plan.billing_cycle === 'yearly') {
    periodEnd.setFullYear(periodEnd.getFullYear() + 1);
  } else {
    periodEnd.setMonth(periodEnd.getMonth() + 1);
  }

  const { error } = await admin
    .from('customer_subscriptions')
    .update({
      status: 'active',
      current_period_start: periodStart.toISOString(),
      current_period_end: periodEnd.toISOString(),
      remaining_uses: Number(plan.includes_count ?? 0),
    })
    .eq('id', subscriptionId);

  if (error) return { ok: false, error: error.message };

  revalidatePath('/admin/assinaturas');
  return { ok: true };
}
