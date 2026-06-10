'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';

const BARBERSHOP_ID = '11111111-1111-1111-1111-111111111111';

// =============================================================================
// CONFIG DE FIDELIDADE
// =============================================================================

export async function updateLoyaltyConfig(data: {
  loyalty_enabled: boolean;
  loyalty_points_per_brl: number;
}) {
  const admin = createAdminClient();

  const { error } = await admin
    .from('barbershops')
    .update({
      loyalty_enabled: data.loyalty_enabled,
      loyalty_points_per_brl: data.loyalty_points_per_brl,
    })
    .eq('id', BARBERSHOP_ID);

  if (error) return { ok: false, error: error.message };

  revalidatePath('/admin/fidelidade');
  revalidatePath('/admin/configuracoes');
  return { ok: true };
}

// =============================================================================
// REWARDS (PRÊMIOS)
// =============================================================================

export interface RewardFormData {
  name: string;
  description?: string | null;
  points_required: number;
  reward_type: string;
  reward_value?: number | null;
  service_id?: string | null;
  product_id?: string | null;
  active?: boolean;
  display_order?: number;
}

function nullIfEmpty(v?: string | null) {
  if (!v) return null;
  const t = v.trim();
  return t.length === 0 ? null : t;
}

export async function createReward(data: RewardFormData) {
  const admin = createAdminClient();

  const { error } = await admin.from('loyalty_rewards').insert({
    barbershop_id: BARBERSHOP_ID,
    name: data.name,
    description: nullIfEmpty(data.description),
    points_required: data.points_required,
    reward_type: data.reward_type,
    reward_value: data.reward_value ?? null,
    service_id: data.service_id || null,
    product_id: data.product_id || null,
    active: data.active ?? true,
    display_order: data.display_order ?? 0,
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath('/admin/fidelidade');
  return { ok: true };
}

export async function updateReward(rewardId: string, data: RewardFormData) {
  const admin = createAdminClient();

  const { error } = await admin
    .from('loyalty_rewards')
    .update({
      name: data.name,
      description: nullIfEmpty(data.description),
      points_required: data.points_required,
      reward_type: data.reward_type,
      reward_value: data.reward_value ?? null,
      service_id: data.service_id || null,
      product_id: data.product_id || null,
      active: data.active ?? true,
      display_order: data.display_order ?? 0,
    })
    .eq('id', rewardId);

  if (error) return { ok: false, error: error.message };

  revalidatePath('/admin/fidelidade');
  return { ok: true };
}

export async function deleteReward(rewardId: string) {
  const admin = createAdminClient();

  // Soft delete: desativa
  const { error } = await admin
    .from('loyalty_rewards')
    .update({ active: false })
    .eq('id', rewardId);

  if (error) return { ok: false, error: error.message };

  revalidatePath('/admin/fidelidade');
  return { ok: true };
}

// =============================================================================
// PONTOS DE CLIENTES
// =============================================================================

/**
 * Adiciona pontos manualmente a um cliente (admin override).
 */
export async function adjustCustomerPoints(
  customerId: string,
  delta: number,
  reason: string
) {
  const admin = createAdminClient();

  // Garante registro de loyalty_points
  const { data: current } = await admin
    .from('loyalty_points')
    .select('id, balance, lifetime_earned, lifetime_redeemed')
    .eq('barbershop_id', BARBERSHOP_ID)
    .eq('customer_id', customerId)
    .maybeSingle();

  if (!current) {
    const initBalance = Math.max(0, delta);
    const { error: errInsert } = await admin.from('loyalty_points').insert({
      barbershop_id: BARBERSHOP_ID,
      customer_id: customerId,
      balance: initBalance,
      lifetime_earned: delta > 0 ? delta : 0,
      lifetime_redeemed: delta < 0 ? Math.abs(delta) : 0,
    });
    if (errInsert) return { ok: false, error: errInsert.message };
  } else {
    const newBalance = Math.max(0, Number(current.balance ?? 0) + delta);
    const newEarned =
      delta > 0
        ? Number(current.lifetime_earned ?? 0) + delta
        : Number(current.lifetime_earned ?? 0);
    const newRedeemed =
      delta < 0
        ? Number(current.lifetime_redeemed ?? 0) + Math.abs(delta)
        : Number(current.lifetime_redeemed ?? 0);

    const { error: errUpdate } = await admin
      .from('loyalty_points')
      .update({
        balance: newBalance,
        lifetime_earned: newEarned,
        lifetime_redeemed: newRedeemed,
      })
      .eq('id', current.id);
    if (errUpdate) return { ok: false, error: errUpdate.message };
  }

  // Registra transação
  await admin.from('loyalty_transactions').insert({
    barbershop_id: BARBERSHOP_ID,
    customer_id: customerId,
    type: 'adjust',
    points: delta,
    reason,
  });

  revalidatePath('/admin/fidelidade');
  return { ok: true };
}

/**
 * Resgata um prêmio para um cliente (debita pontos).
 */
export async function redeemReward(customerId: string, rewardId: string) {
  const admin = createAdminClient();

  // Busca prêmio
  const { data: reward } = await admin
    .from('loyalty_rewards')
    .select('name, points_required, active')
    .eq('id', rewardId)
    .maybeSingle();

  if (!reward) return { ok: false, error: 'Prêmio não encontrado' };
  if (!reward.active) return { ok: false, error: 'Prêmio inativo' };

  // Busca saldo atual
  const { data: pts } = await admin
    .from('loyalty_points')
    .select('id, balance, lifetime_redeemed')
    .eq('barbershop_id', BARBERSHOP_ID)
    .eq('customer_id', customerId)
    .maybeSingle();

  const balance = Number(pts?.balance ?? 0);
  const required = Number(reward.points_required ?? 0);

  if (balance < required) {
    return {
      ok: false,
      error: `Saldo insuficiente: cliente tem ${balance} pts, precisa de ${required} pts`,
    };
  }

  // Debita
  if (pts) {
    await admin
      .from('loyalty_points')
      .update({
        balance: balance - required,
        lifetime_redeemed:
          Number(pts.lifetime_redeemed ?? 0) + required,
      })
      .eq('id', pts.id);
  }

  // Registra transação
  await admin.from('loyalty_transactions').insert({
    barbershop_id: BARBERSHOP_ID,
    customer_id: customerId,
    type: 'redeem',
    points: -required,
    reason: `Resgate: ${reward.name}`,
    reward_id: rewardId,
  });

  revalidatePath('/admin/fidelidade');
  return { ok: true };
}
