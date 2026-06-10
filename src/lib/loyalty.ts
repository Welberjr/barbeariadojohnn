/**
 * Fidelidade: acumulo de pontos + rankings.
 *
 * Regra do negocio (definida pelo Johnn/Welber): cada R$ 1,00 gasto = N pontos
 * (config em barbershops.loyalty_points_per_brl, hoje 10).
 *
 * Rankings:
 *  - Geral: lifetime_earned (nunca zera)
 *  - Semestral: soma dos eventos positivos dentro do semestre civil corrente
 *    (jan-jun / jul-dez). Nao precisa de cron de reset: a janela move sozinha.
 */
import { createAdminClient } from '@/lib/supabase/admin';
import { notifyCustomer } from '@/lib/notifications';

const BARBERSHOP_ID = '11111111-1111-1111-1111-111111111111';

export function currentSemesterStart(now = new Date()): Date {
  const year = now.getFullYear();
  const startMonth = now.getMonth() < 6 ? 0 : 6; // jan ou jul
  return new Date(Date.UTC(year, startMonth, 1, 0, 0, 0));
}

export function semesterLabel(now = new Date()): string {
  const half = now.getMonth() < 6 ? 1 : 2;
  return `${half}º semestre de ${now.getFullYear()}`;
}

/**
 * Credita pontos de uma comanda fechada. Idempotente por comanda:
 * se ja existe evento earned_service para a comanda, nao credita de novo.
 */
export async function awardPointsForComanda(opts: {
  comandaId: string;
  customerId: string;
  amount: number;
}) {
  try {
    const admin = createAdminClient();
    if (opts.amount <= 0) return { ok: true, points: 0 };

    const { data: shop } = await admin
      .from('barbershops')
      .select('loyalty_enabled, loyalty_points_per_brl')
      .eq('id', BARBERSHOP_ID)
      .maybeSingle();

    if (!shop?.loyalty_enabled) return { ok: true, points: 0 };
    const perBrl = Number(shop.loyalty_points_per_brl ?? 0);
    if (perBrl <= 0) return { ok: true, points: 0 };

    // Idempotencia por comanda
    const { data: existing } = await admin
      .from('loyalty_points_events')
      .select('id')
      .eq('comanda_id', opts.comandaId)
      .eq('event_type', 'earned_service')
      .maybeSingle();
    if (existing) return { ok: true, points: 0 };

    const points = Math.round(opts.amount * perBrl);
    if (points <= 0) return { ok: true, points: 0 };

    // Atualiza saldo agregado
    const { data: current } = await admin
      .from('loyalty_points')
      .select('id, balance, lifetime_earned')
      .eq('barbershop_id', BARBERSHOP_ID)
      .eq('customer_id', opts.customerId)
      .maybeSingle();

    let balanceAfter = points;
    if (!current) {
      await admin.from('loyalty_points').insert({
        barbershop_id: BARBERSHOP_ID,
        customer_id: opts.customerId,
        balance: points,
        lifetime_earned: points,
        lifetime_redeemed: 0,
      });
    } else {
      balanceAfter = Number(current.balance ?? 0) + points;
      await admin
        .from('loyalty_points')
        .update({
          balance: balanceAfter,
          lifetime_earned: Number(current.lifetime_earned ?? 0) + points,
        })
        .eq('id', current.id);
    }

    // Evento (alimenta ranking semestral) + extrato legado
    await admin.from('loyalty_points_events').insert({
      barbershop_id: BARBERSHOP_ID,
      customer_id: opts.customerId,
      event_type: 'earned_service',
      points,
      balance_after: balanceAfter,
      comanda_id: opts.comandaId,
      description: 'Pontos do atendimento',
    });
    await admin.from('loyalty_transactions').insert({
      barbershop_id: BARBERSHOP_ID,
      customer_id: opts.customerId,
      type: 'earn',
      points,
      reason: 'Atendimento na barbearia',
    });

    // Espelha no cadastro (a lista de clientes le customers.loyalty_points)
    await admin
      .from('customers')
      .update({
        loyalty_points: balanceAfter,
        last_visit_at: new Date().toISOString(),
      })
      .eq('id', opts.customerId);

    await notifyCustomer({
      customerId: opts.customerId,
      type: 'pontos_ganhos',
      title: `Você ganhou ${points} pontos!`,
      body: `Seu atendimento rendeu ${points} pontos de fidelidade. Saldo atual: ${balanceAfter} pontos. Continue acumulando e suba no ranking!`,
      whatsapp: false,
    });

    return { ok: true, points };
  } catch {
    return { ok: false, points: 0 };
  }
}

export interface RankingRow {
  customer_id: string;
  full_name: string;
  photo_url: string | null;
  points: number;
  position: number;
}

/**
 * Ranking geral (lifetime) e semestral, com posicao do cliente atual.
 */
export async function getRankings(opts: {
  limit?: number;
  highlightCustomerId?: string;
}) {
  const admin = createAdminClient();
  const limit = opts.limit ?? 20;

  // GERAL: lifetime_earned
  const { data: lifetimeRows } = await admin
    .from('loyalty_points')
    .select(
      'customer_id, lifetime_earned, customers:customers(full_name, photo_url, active)'
    )
    .eq('barbershop_id', BARBERSHOP_ID)
    .order('lifetime_earned', { ascending: false })
    .limit(500);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allTime: RankingRow[] = ((lifetimeRows ?? []) as any[])
    .filter((r) => r.customers && r.customers.active !== false)
    .map((r, i) => ({
      customer_id: r.customer_id,
      full_name: r.customers.full_name as string,
      photo_url: (r.customers.photo_url as string | null) ?? null,
      points: Number(r.lifetime_earned ?? 0),
      position: i + 1,
    }));

  // SEMESTRAL: soma de eventos positivos na janela corrente
  const semStart = currentSemesterStart().toISOString();
  const { data: events } = await admin
    .from('loyalty_points_events')
    .select('customer_id, points')
    .eq('barbershop_id', BARBERSHOP_ID)
    .gt('points', 0)
    .gte('created_at', semStart)
    .limit(10000);

  const sums = new Map<string, number>();
  for (const e of events ?? []) {
    sums.set(
      e.customer_id as string,
      (sums.get(e.customer_id as string) ?? 0) + Number(e.points)
    );
  }
  const nameMap = new Map(allTime.map((r) => [r.customer_id, r]));
  // Clientes que pontuaram no semestre mas nao vieram no top lifetime
  const missingIds = Array.from(sums.keys()).filter((id) => !nameMap.has(id));
  if (missingIds.length > 0) {
    const { data: extra } = await admin
      .from('customers')
      .select('id, full_name, photo_url')
      .in('id', missingIds);
    for (const c of extra ?? []) {
      nameMap.set(c.id as string, {
        customer_id: c.id as string,
        full_name: c.full_name as string,
        photo_url: (c.photo_url as string | null) ?? null,
        points: 0,
        position: 0,
      });
    }
  }

  const semester: RankingRow[] = Array.from(sums.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([id, pts], i) => ({
      customer_id: id,
      full_name: nameMap.get(id)?.full_name ?? 'Cliente',
      photo_url: nameMap.get(id)?.photo_url ?? null,
      points: pts,
      position: i + 1,
    }));

  const find = (rows: RankingRow[]) =>
    opts.highlightCustomerId
      ? rows.find((r) => r.customer_id === opts.highlightCustomerId) ?? null
      : null;

  return {
    allTime: allTime.slice(0, limit),
    semester: semester.slice(0, limit),
    myAllTime: find(allTime),
    mySemester: find(semester),
    semesterLabel: semesterLabel(),
  };
}
