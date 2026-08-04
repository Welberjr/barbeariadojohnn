import { NextResponse } from 'next/server';
import { getSessionCustomer } from '@/lib/customer-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  drawWeeklyBonus,
  getISOWeek,
  weeklyBonusReason,
} from '@/lib/weekly-bonus';

async function getCustomerStore() {
  const customer = await getSessionCustomer();
  if (!customer) return null;

  // Nunca usa a loja padrão: a sessão do cliente fica limitada à unidade da
  // própria ficha, mesmo que a rede tenha várias lojas.
  const admin = createAdminClient();
  const { data: scopedCustomer } = await admin
    .from('customers')
    .select('barbershop_id')
    .eq('id', customer.id)
    .maybeSingle();

  if (!scopedCustomer?.barbershop_id) return null;
  return {
    admin,
    customer,
    barbershopId: scopedCustomer.barbershop_id as string,
  };
}

// GET: verifica se o cliente já raspou esta semana
export async function GET() {
  const scope = await getCustomerStore();
  if (!scope) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const weekKey = getISOWeek(new Date());
  const reason = weeklyBonusReason();
  const { data } = await scope.admin
    .from('loyalty_transactions')
    .select('id, points')
    .eq('barbershop_id', scope.barbershopId)
    .eq('customer_id', scope.customer.id)
    .eq('reason', reason)
    .maybeSingle();

  return NextResponse.json({ used: !!data, points: data?.points ?? null, weekKey });
}

// POST: credita os pontos da raspadinha (idempotente por semana)
export async function POST() {
  const scope = await getCustomerStore();
  if (!scope) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const weekKey = getISOWeek(new Date());
  const reason = weeklyBonusReason();
  const { data: existing } = await scope.admin
    .from('loyalty_transactions')
    .select('id, points')
    .eq('barbershop_id', scope.barbershopId)
    .eq('customer_id', scope.customer.id)
    .eq('reason', reason)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      {
        error: 'Raspadinha já usada esta semana',
        alreadyUsed: true,
        points: existing.points,
      },
      { status: 409 }
    );
  }

  // Valor sorteado no servidor: o cliente não consegue escolher os pontos ao
  // editar a requisição no navegador.
  const points = drawWeeklyBonus();
  const { error: transactionError } = await scope.admin
    .from('loyalty_transactions')
    .insert({
      barbershop_id: scope.barbershopId,
      customer_id: scope.customer.id,
      type: 'bonus',
      points,
      reason,
    });

  // O índice único da migração protege a corrida entre duas abas.
  if (transactionError) {
    if (transactionError.code === '23505') {
      return NextResponse.json(
        { error: 'Raspadinha já usada esta semana', alreadyUsed: true },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: 'Não foi possível creditar os pontos.' },
      { status: 500 }
    );
  }

  const { data: loyaltyPoints } = await scope.admin
    .from('loyalty_points')
    .select('balance, lifetime_earned')
    .eq('barbershop_id', scope.barbershopId)
    .eq('customer_id', scope.customer.id)
    .maybeSingle();

  if (loyaltyPoints) {
    const { error } = await scope.admin
      .from('loyalty_points')
      .update({
        balance: Number(loyaltyPoints.balance ?? 0) + points,
        lifetime_earned: Number(loyaltyPoints.lifetime_earned ?? 0) + points,
        updated_at: new Date().toISOString(),
      })
      .eq('barbershop_id', scope.barbershopId)
      .eq('customer_id', scope.customer.id);
    if (error) {
      return NextResponse.json(
        { error: 'Pontos registrados, mas o saldo precisa ser conciliado.' },
        { status: 500 }
      );
    }
  } else {
    const { error } = await scope.admin.from('loyalty_points').insert({
      barbershop_id: scope.barbershopId,
      customer_id: scope.customer.id,
      balance: points,
      lifetime_earned: points,
      lifetime_redeemed: 0,
    });
    if (error) {
      return NextResponse.json(
        { error: 'Pontos registrados, mas o saldo precisa ser conciliado.' },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ ok: true, points, weekKey });
}

export const dynamic = 'force-dynamic';
