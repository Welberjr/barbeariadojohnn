'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

const BARBERSHOP_ID = '11111111-1111-1111-1111-111111111111';

// ============================================================
// RECEITAS / DESPESAS MANUAIS
// ============================================================

const INCOME_CATEGORIES = ['Gorjeta', 'Serviço Extra', 'Outros'];
const EXPENSE_CATEGORIES = ['Utilidades', 'Limpeza', 'Produtos', 'Manutenção', 'Aluguel', 'Outros'];

export { INCOME_CATEGORIES, EXPENSE_CATEGORIES };

export async function addIncome(data: {
  category: string;
  staff_id: string | null;
  description: string;
  amount: number;
  occurred_at: string;
}) {
  const supabase = await createClient();
  const { error } = await supabase.from('transactions').insert({
    barbershop_id: BARBERSHOP_ID,
    type: 'other',
    amount: data.amount,
    description: data.description || data.category,
    category: data.category,
    staff_id: data.staff_id || null,
    occurred_at: data.occurred_at,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath('/admin/financeiro');
  return { ok: true };
}

export async function addExpense(data: {
  category: string;
  staff_id: string | null;
  description: string;
  amount: number;
  occurred_at: string;
}) {
  const supabase = await createClient();
  const { error } = await supabase.from('transactions').insert({
    barbershop_id: BARBERSHOP_ID,
    type: 'expense',
    amount: data.amount,
    description: data.description || data.category,
    category: data.category,
    staff_id: data.staff_id || null,
    occurred_at: data.occurred_at,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath('/admin/financeiro');
  return { ok: true };
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
  const supabase = await createClient();
  const { error } = await supabase.from('allowances').insert({
    barbershop_id: BARBERSHOP_ID,
    staff_id: data.staff_id,
    amount: data.amount,
    reason: data.reason,
    status: 'approved', // admin lança direto como aprovado
    requested_at: new Date().toISOString(),
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath('/admin/financeiro');
  return { ok: true };
}

export async function approveAllowance(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from('allowances')
    .update({ status: 'approved', reviewed_at: new Date().toISOString() })
    .eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/admin/financeiro');
  return { ok: true };
}

export async function rejectAllowance(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from('allowances')
    .update({ status: 'rejected', reviewed_at: new Date().toISOString() })
    .eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/admin/financeiro');
  return { ok: true };
}

export async function deleteAllowance(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from('allowances').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/admin/financeiro');
  return { ok: true };
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
  const supabase = await createClient();
  const today = new Date().toISOString().split('T')[0];
  const { error } = await supabase.from('commission_payouts').insert({
    barbershop_id: BARBERSHOP_ID,
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
