'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';

const BARBERSHOP_ID = '11111111-1111-1111-1111-111111111111';

export async function payCommission(opts: {
  staffId: string;
  amount: number;
  periodStart: string;
  periodEnd: string;
  method: string;
}) {
  const admin = createAdminClient();

  const today = new Date().toISOString().split('T')[0];

  const { error } = await admin.from('commission_payouts').insert({
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

  // Registra como despesa no financeiro
  await admin.from('transactions').insert({
    barbershop_id: BARBERSHOP_ID,
    type: 'commission',
    amount: opts.amount,
    description: 'Comissão paga',
    staff_id: opts.staffId,
    payment_method: opts.method,
    occurred_at: new Date().toISOString(),
  });

  revalidatePath('/admin/financeiro');
  return { ok: true };
}
