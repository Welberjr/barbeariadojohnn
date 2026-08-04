'use server';

import { createManagerClient } from '@/lib/supabase/manager';
import { revalidatePath } from 'next/cache';
import { getSessionStaff } from '@/lib/staff-auth';

import { lojaAtual } from '@/lib/loja';
import { requireScopedMutation } from '@/lib/tenant-ownership';
// ============================================================
// RECEITAS / DESPESAS MANUAIS
// ============================================================



export async function addIncome(data: {
  category: string;
  staff_id: string | null;
  description: string;
  amount: number;
  occurred_at: string;
}) {
  const supabase = await createManagerClient();
  const { error } = await supabase.from('transactions').insert({
    barbershop_id: (await lojaAtual()),
    type: 'other',
    amount: data.amount,
    description: data.description || data.category,
    category: data.category,
    staff_id: data.staff_id || null,
    occurred_at: data.occurred_at,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath('/admin/financeiro');
  return { ok: true as const };
}

export async function addExpense(data: {
  category: string;
  staff_id: string | null;
  description: string;
  amount: number;
  occurred_at: string;
}) {
  const supabase = await createManagerClient();
  const { error } = await supabase.from('transactions').insert({
    barbershop_id: (await lojaAtual()),
    type: 'expense',
    amount: data.amount,
    description: data.description || data.category,
    category: data.category,
    staff_id: data.staff_id || null,
    occurred_at: data.occurred_at,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath('/admin/financeiro');
  return { ok: true as const };
}

// ============================================================
// VALES / ADIANTAMENTOS
// ============================================================

export async function createAllowance(data: {
  staff_id: string;
  amount: number;
  reason: string;
  reference_month: string; // yyyy-mm
}) {
  const supabase = await createManagerClient();
  const { error } = await supabase.from('allowances').insert({
    barbershop_id: (await lojaAtual()),
    staff_id: data.staff_id,
    amount: data.amount,
    reason: data.reason,
    status: 'approved', // admin lança direto como aprovado
    requested_at: new Date().toISOString(),
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath('/admin/financeiro');
  return { ok: true as const };
}

export async function approveAllowance(id: string) {
  const supabase = await createManagerClient();
  const gestor = await getSessionStaff();
  const barbershopId = await lojaAtual();

  const { data, error } = await supabase
    .from('allowances')
    .update({
      status: 'approved',
      reviewed_at: new Date().toISOString(),
      reviewed_by: gestor?.profileId ?? null,
    })
    .eq('id', id)
    .eq('barbershop_id', barbershopId)
    .select('id');
  const mutation = requireScopedMutation(data, error, 'Vale');
  if (!mutation.ok) return mutation;
  revalidatePath('/admin/financeiro');
  revalidatePath('/painel/vales');
  return { ok: true as const };
}

export async function rejectAllowance(id: string) {
  const supabase = await createManagerClient();
  const gestor = await getSessionStaff();
  const barbershopId = await lojaAtual();

  const { data, error } = await supabase
    .from('allowances')
    .update({
      status: 'rejected',
      reviewed_at: new Date().toISOString(),
      reviewed_by: gestor?.profileId ?? null,
    })
    .eq('id', id)
    .eq('barbershop_id', barbershopId)
    .select('id');
  const mutation = requireScopedMutation(data, error, 'Vale');
  if (!mutation.ok) return mutation;
  revalidatePath('/admin/financeiro');
  revalidatePath('/painel/vales');
  return { ok: true as const };
}

export async function deleteAllowance(id: string) {
  const supabase = await createManagerClient();
  const barbershopId = await lojaAtual();
  const { data, error } = await supabase
    .from('allowances')
    .delete()
    .eq('id', id)
    .eq('barbershop_id', barbershopId)
    .select('id');
  const mutation = requireScopedMutation(data, error, 'Vale');
  if (!mutation.ok) return mutation;
  revalidatePath('/admin/financeiro');
  return { ok: true as const };
}

// ============================================================
// PAGAMENTO DE COMISSÃO
// ============================================================

export async function payCommission(opts: {
  staffId: string;
  amount: number;
  periodStart: string;
  periodEnd: string;
  method: string;
}) {
  const supabase = await createManagerClient();
  const today = new Date().toISOString().split('T')[0];
  const { error } = await supabase.from('commission_payouts').insert({
    barbershop_id: (await lojaAtual()),
    staff_id: opts.staffId,
    amount_paid: opts.amount,
    total_commissions: opts.amount,
    total_allowances: 0,
    total_expenses: 0,
    period_start: opts.periodStart,
    period_end: opts.periodEnd,
    payment_date: today,
    payment_method: opts.method,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath('/admin/financeiro');
  return { ok: true };
}
