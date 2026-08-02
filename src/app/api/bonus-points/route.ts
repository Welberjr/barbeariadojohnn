import { NextRequest, NextResponse } from 'next/server';
import { getSessionCustomer } from '@/lib/customer-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { getISOWeek, weeklyBonusReason } from '@/lib/weekly-bonus';

import { lojaPadrao } from '@/lib/loja';
// GET: verifica se o cliente já raspou esta semana
export async function GET() {
  const customer = await getSessionCustomer();
  if (!customer) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

  const admin = createAdminClient();
  const weekKey = getISOWeek(new Date());
  const reason = weeklyBonusReason();

  const { data } = await admin
    .from('loyalty_transactions')
    .select('id, points')
    .eq('customer_id', customer.id)
    .eq('reason', reason)
    .maybeSingle();

  return NextResponse.json({ used: !!data, points: data?.points ?? null, weekKey });
}

// POST: credita os pontos da raspadinha (idempotente por semana)
export async function POST(req: NextRequest) {
  const customer = await getSessionCustomer();
  if (!customer) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

  const { points } = await req.json() as { points: number };
  if (!points || points < 0 || points > 1000) {
    return NextResponse.json({ error: 'Pontos inválidos' }, { status: 400 });
  }

  const admin = createAdminClient();
  const weekKey = getISOWeek(new Date());
  const reason = weeklyBonusReason();

  // Já raspou esta semana? Bloquear duplicação
  const { data: existing } = await admin
    .from('loyalty_transactions')
    .select('id')
    .eq('customer_id', customer.id)
    .eq('reason', reason)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: 'Raspadinha já usada esta semana', alreadyUsed: true }, { status: 409 });
  }

  // Registrar transação
  await admin.from('loyalty_transactions').insert({
    barbershop_id: (await lojaPadrao()),
    customer_id: customer.id,
    type: 'bonus',
    points,
    reason,
  });

  // Atualizar saldo
  const { data: lp } = await admin
    .from('loyalty_points')
    .select('balance, lifetime_earned')
    .eq('customer_id', customer.id)
    .maybeSingle();

  if (lp) {
    await admin
      .from('loyalty_points')
      .update({
        balance: (lp.balance ?? 0) + points,
        lifetime_earned: (lp.lifetime_earned ?? 0) + points,
        updated_at: new Date().toISOString(),
      })
      .eq('customer_id', customer.id);
  } else {
    await admin.from('loyalty_points').insert({
      barbershop_id: (await lojaPadrao()),
      customer_id: customer.id,
      balance: points,
      lifetime_earned: points,
      lifetime_redeemed: 0,
    });
  }

  return NextResponse.json({ ok: true, points, weekKey });
}
