import { NextRequest, NextResponse } from 'next/server';
import { getSessionCustomer } from '@/lib/customer-auth';
import { createAdminClient } from '@/lib/supabase/admin';

const BARBERSHOP_ID = '11111111-1111-1111-1111-111111111111';

// Retorna a chave ISO da semana atual (ex: "2026-W24")
function getISOWeek(d: Date): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

// GET: verifica se o cliente já raspou esta semana
export async function GET() {
  const customer = await getSessionCustomer();
  if (!customer) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

  const admin = createAdminClient();
  const weekKey = getISOWeek(new Date());
  const reason = `raspadinha_semanal:${weekKey}`;

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
  const reason = `raspadinha_semanal:${weekKey}`;

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
    barbershop_id: BARBERSHOP_ID,
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
      barbershop_id: BARBERSHOP_ID,
      customer_id: customer.id,
      balance: points,
      lifetime_earned: points,
      lifetime_redeemed: 0,
    });
  }

  return NextResponse.json({ ok: true, points, weekKey });
}