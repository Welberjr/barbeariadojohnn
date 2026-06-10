'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';

const BARBERSHOP_ID = '11111111-1111-1111-1111-111111111111';

export interface BillFormData {
  description: string;
  amount: number;
  due_date: string; // YYYY-MM-DD
  category_id?: string | null;
  supplier?: string | null;
  notes?: string | null;
  is_recurring?: boolean;
  recurrence_type?: string | null;
  recurrence_day?: number | null;
  status?: string;
}

function nullIfEmpty(v?: string | null) {
  if (!v) return null;
  const t = v.trim();
  return t.length === 0 ? null : t;
}

export async function createBill(data: BillFormData) {
  const admin = createAdminClient();

  const { error } = await admin.from('bills').insert({
    barbershop_id: BARBERSHOP_ID,
    description: data.description,
    amount: data.amount,
    due_date: data.due_date,
    category_id: data.category_id || null,
    supplier: nullIfEmpty(data.supplier),
    notes: nullIfEmpty(data.notes),
    is_recurring: data.is_recurring ?? false,
    recurrence_type: data.is_recurring ? data.recurrence_type ?? 'monthly' : null,
    recurrence_day: data.is_recurring ? data.recurrence_day ?? null : null,
    status: data.status ?? 'pending',
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath('/admin/contas-pagar');
  revalidatePath('/admin/dre');
  return { ok: true };
}

export async function updateBill(billId: string, data: BillFormData) {
  const admin = createAdminClient();

  const { error } = await admin
    .from('bills')
    .update({
      description: data.description,
      amount: data.amount,
      due_date: data.due_date,
      category_id: data.category_id || null,
      supplier: nullIfEmpty(data.supplier),
      notes: nullIfEmpty(data.notes),
      is_recurring: data.is_recurring ?? false,
      recurrence_type: data.is_recurring ? data.recurrence_type ?? 'monthly' : null,
      recurrence_day: data.is_recurring ? data.recurrence_day ?? null : null,
      status: data.status ?? 'pending',
    })
    .eq('id', billId);

  if (error) return { ok: false, error: error.message };

  revalidatePath('/admin/contas-pagar');
  revalidatePath(`/admin/contas-pagar/${billId}`);
  revalidatePath('/admin/dre');
  return { ok: true };
}

export async function deleteBill(billId: string) {
  const admin = createAdminClient();

  const { error } = await admin.from('bills').delete().eq('id', billId);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/admin/contas-pagar');
  revalidatePath('/admin/dre');
  return { ok: true };
}

/**
 * Marca uma conta como paga.
 */
export async function markBillAsPaid(
  billId: string,
  paymentMethod: string,
  paidAmount?: number
) {
  const admin = createAdminClient();

  // Buscar amount original se paidAmount não foi informado
  let finalPaidAmount = paidAmount;
  if (finalPaidAmount === undefined || finalPaidAmount === null) {
    const { data: bill } = await admin
      .from('bills')
      .select('amount')
      .eq('id', billId)
      .maybeSingle();
    finalPaidAmount = Number(bill?.amount ?? 0);
  }

  const { error } = await admin
    .from('bills')
    .update({
      status: 'paid',
      paid_at: new Date().toISOString(),
      paid_amount: finalPaidAmount,
      payment_method: paymentMethod,
    })
    .eq('id', billId);

  if (error) return { ok: false, error: error.message };

  revalidatePath('/admin/contas-pagar');
  revalidatePath('/admin/dre');
  return { ok: true };
}

/**
 * Reabre uma conta paga (volta para pending).
 */
export async function reopenBill(billId: string) {
  const admin = createAdminClient();

  const { error } = await admin
    .from('bills')
    .update({
      status: 'pending',
      paid_at: null,
      paid_amount: null,
      payment_method: null,
    })
    .eq('id', billId);

  if (error) return { ok: false, error: error.message };

  revalidatePath('/admin/contas-pagar');
  revalidatePath('/admin/dre');
  return { ok: true };
}

/**
 * Cria a próxima ocorrência de uma conta recorrente.
 */
export async function generateNextRecurrence(billId: string) {
  const admin = createAdminClient();

  const { data: bill } = await admin
    .from('bills')
    .select('*')
    .eq('id', billId)
    .maybeSingle();

  if (!bill || !bill.is_recurring) {
    return { ok: false, error: 'Conta não é recorrente' };
  }

  // Calcula próxima data de vencimento
  const due = new Date(bill.due_date as string);
  if (bill.recurrence_type === 'monthly') {
    due.setMonth(due.getMonth() + 1);
  } else if (bill.recurrence_type === 'weekly') {
    due.setDate(due.getDate() + 7);
  } else if (bill.recurrence_type === 'yearly') {
    due.setFullYear(due.getFullYear() + 1);
  }

  const nextDueDate = due.toISOString().split('T')[0];

  // Verifica se já existe (evita duplicar)
  const { data: existing } = await admin
    .from('bills')
    .select('id')
    .eq('barbershop_id', BARBERSHOP_ID)
    .eq('description', bill.description)
    .eq('due_date', nextDueDate)
    .maybeSingle();

  if (existing) {
    return { ok: true, skipped: true };
  }

  const { error } = await admin.from('bills').insert({
    barbershop_id: BARBERSHOP_ID,
    description: bill.description,
    amount: bill.amount,
    due_date: nextDueDate,
    category_id: bill.category_id,
    supplier: bill.supplier,
    notes: bill.notes,
    is_recurring: true,
    recurrence_type: bill.recurrence_type,
    recurrence_day: bill.recurrence_day,
    status: 'pending',
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath('/admin/contas-pagar');
  return { ok: true };
}
