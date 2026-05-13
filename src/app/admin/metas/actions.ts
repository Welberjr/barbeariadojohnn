'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';

const BARBERSHOP_ID = '11111111-1111-1111-1111-111111111111';

export interface GoalFormData {
  staff_id?: string | null; // null = meta da barbearia
  period_type: 'month' | 'week' | 'year';
  year: number;
  month?: number | null;
  week?: number | null;
  revenue_target: number;
}

export async function upsertGoal(data: GoalFormData) {
  const admin = createAdminClient();

  // Cria payload sem campos não usados pelo period_type
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payload: any = {
    barbershop_id: BARBERSHOP_ID,
    staff_id: data.staff_id || null,
    period_type: data.period_type,
    year: data.year,
    revenue_target: data.revenue_target,
  };

  if (data.period_type === 'month') payload.month = data.month ?? null;
  else payload.month = null;

  if (data.period_type === 'week') payload.week = data.week ?? null;
  else payload.week = null;

  // Upsert manual: tenta encontrar meta existente do mesmo período/staff
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = admin
    .from('goals')
    .select('id')
    .eq('barbershop_id', BARBERSHOP_ID)
    .eq('period_type', data.period_type)
    .eq('year', data.year);

  if (data.staff_id) query = query.eq('staff_id', data.staff_id);
  else query = query.is('staff_id', null);

  if (data.period_type === 'month')
    query = query.eq('month', data.month ?? 0);
  if (data.period_type === 'week') query = query.eq('week', data.week ?? 0);

  const { data: existing } = await query.maybeSingle();

  if (existing?.id) {
    const { error } = await admin
      .from('goals')
      .update({ revenue_target: data.revenue_target })
      .eq('id', existing.id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await admin.from('goals').insert(payload);
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath('/admin/metas');
  return { ok: true };
}

export async function deleteGoal(goalId: string) {
  const admin = createAdminClient();
  const { error } = await admin.from('goals').delete().eq('id', goalId);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/admin/metas');
  return { ok: true };
}
