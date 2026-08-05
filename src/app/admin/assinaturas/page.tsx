import { createAdminClient } from '@/lib/supabase/admin';
import { Crown, Plus, Users, TrendingUp, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { formatCurrency } from '@/lib/utils';
import { subscriptionKpis } from '@/lib/subscriptions';
import { AssinaturasView } from './_components/assinaturas-view';
import { SobrasSection } from './_components/sobras-section';

import { lojaAtual } from '@/lib/loja';
export const metadata = {
  title: 'Assinaturas',
};

export const dynamic = 'force-dynamic';

export default async function AssinaturasPage() {
  const admin = createAdminClient();

  // Primeira leva: planos, assinaturas, repasses e clientes não dependem
  // um do outro, então vão juntos ao banco.
  const [
    { data: plansRaw },
    { data: subsRaw },
    { data: payoutsRaw },
    { data: allCustomers },
  ] = await Promise.all([
    // Planos (modelo normalizado)
    admin
      .from('subscription_plans')
      .select(
        'id, name, description, price, period, allowed_days, included_uses, barber_share_percent, accumulate_unused, show_on_public_menu, active, display_order, leftover_destination'
      )
      .eq('barbershop_id', (await lojaAtual()))
      .order('display_order')
      .order('name'),
    // Assinaturas com cliente + plano
    admin
      .from('subscriptions')
      .select(
        `id, status, customer_id, plan_id, started_at, cancelled_at,
       current_period_start, current_period_end, next_billing_at, current_price, notes,
       customer:customers (full_name, phone, photo_url),
       plan:subscription_plans (name, price, period, allowed_days, included_uses, barber_share_percent)`
      )
      .eq('barbershop_id', (await lojaAtual()))
      .order('created_at', { ascending: false }),
    // Repasses recentes (potinho fechado)
    admin
      .from('subscription_payouts')
      .select(
        `id, created_at, period_start, period_end, plan_price, barber_share_percent,
       pool_amount, total_uses, included_uses, unused_uses, leftover_amount, leftover_destination,
       subscription:subscriptions ( customer:customers (full_name) )`
      )
      .eq('barbershop_id', (await lojaAtual()))
      .order('created_at', { ascending: false })
      .limit(20),
    // Clientes ativos (dropdown de nova assinatura)
    admin
      .from('customers')
      .select('id, full_name, phone')
      .eq('barbershop_id', (await lojaAtual()))
      .eq('active', true)
      .order('full_name')
      .limit(500),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const plans = (plansRaw ?? []).map((p: any) => ({
    ...p,
    price: Number(p.price),
    included_uses: Number(p.included_uses ?? 4),
    barber_share_percent: Number(p.barber_share_percent ?? 50),
    allowed_days: (p.allowed_days ?? []) as number[],
  }));

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const subsList = (subsRaw ?? []) as any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payoutRows = (payoutsRaw ?? []) as any[];

  // Segunda leva: usos do ciclo e itens de repasse dependem dos ids da primeira.
  const subIds = subsList.map((s) => s.id);
  const payoutIds = payoutRows.map((p) => p.id);
  const [usagesResult, payoutItemsResult] = await Promise.all([
    subIds.length > 0
      ? admin
          .from('subscription_usages')
          .select('subscription_id')
          .in('subscription_id', subIds)
          .is('settled_payout_id', null)
      : Promise.resolve({ data: [] as { subscription_id: string }[] }),
    payoutIds.length > 0
      ? admin
          .from('subscription_payout_items')
          .select('payout_id, uses_count, amount, staff:staff (display_name)')
          .in('payout_id', payoutIds)
      : // eslint-disable-next-line @typescript-eslint/no-explicit-any
        Promise.resolve({ data: [] as any[] }),
  ]);

  // Contagem de usos nao acertados (ciclo corrente) por assinatura
  const usageCount = new Map<string, number>();
  for (const u of usagesResult.data ?? []) {
    usageCount.set(
      u.subscription_id as string,
      (usageCount.get(u.subscription_id as string) ?? 0) + 1
    );
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payoutItems: any[] = payoutItemsResult.data ?? [];

  const now = new Date();
  const subscriptions = subsList.map((s) => {
    const included = Number(s.plan?.included_uses ?? 4);
    const used = usageCount.get(s.id) ?? 0;
    const isExpired =
      ['active', 'past_due'].includes(s.status) &&
      now > new Date(s.current_period_end);
    return {
      id: s.id as string,
      status: s.status as string,
      customer_id: s.customer_id as string,
      customer_name: (s.customer?.full_name as string) ?? 'Cliente removido',
      customer_phone: (s.customer?.phone as string | null) ?? null,
      customer_photo: (s.customer?.photo_url as string | null) ?? null,
      plan_name: (s.plan?.name as string) ?? 'Plano removido',
      plan_price: Number(s.current_price ?? s.plan?.price ?? 0),
      plan_period: (s.plan?.period as string) ?? 'monthly',
      allowed_days: (s.plan?.allowed_days ?? []) as number[],
      included_uses: included,
      used_in_cycle: used,
      uses_left: Math.max(0, included - used),
      is_expired: isExpired,
      started_at: s.started_at as string,
      cancelled_at: (s.cancelled_at as string | null) ?? null,
      current_period_start: s.current_period_start as string,
      current_period_end: s.current_period_end as string,
      notes: (s.notes as string | null) ?? null,
    };
  });

  const payouts = payoutRows.map((p) => ({
    id: p.id as string,
    created_at: p.created_at as string,
    period_start: p.period_start as string,
    period_end: p.period_end as string,
    plan_price: Number(p.plan_price),
    share_percent: Number(p.barber_share_percent),
    pool_amount: Number(p.pool_amount),
    total_uses: Number(p.total_uses),
    included_uses: Number(p.included_uses ?? 0),
    unused_uses: Number(p.unused_uses ?? 0),
    leftover_amount: Number(p.leftover_amount ?? 0),
    leftover_destination: (p.leftover_destination as string) ?? 'barbearia',
    customer_name:
      (p.subscription?.customer?.full_name as string) ?? 'Cliente',
    items: payoutItems
      .filter((i) => i.payout_id === p.id)
      .map((i) => ({
        staff_name: (i.staff?.display_name as string) ?? 'Profissional',
        uses: Number(i.uses_count),
        amount: Number(i.amount),
      })),
  }));

  // Sobra prevista do ciclo em aberto, por cliente. É o que o Johnn precisa
  // ver para saber quanto ainda não foi repassado enquanto o ciclo corre.
  const sobrasEmAberto = subscriptions
    .filter((s) => ['active', 'past_due'].includes(s.status))
    .map((s) => {
      const plano = plans.find((p) => p.name === s.plan_name);
      const share = Number(plano?.barber_share_percent ?? 50);
      const poolCents = Math.round(s.plan_price * 100 * (share / 100));
      const valorPorUsoCents =
        s.included_uses > 0 ? Math.floor(poolCents / s.included_uses) : 0;
      const usados = Math.min(s.used_in_cycle, s.included_uses);
      const sobraCents = poolCents - usados * valorPorUsoCents;

      return {
        assinaturaId: s.id,
        cliente: s.customer_name,
        plano: s.plan_name,
        usados: s.used_in_cycle,
        inclusos: s.included_uses,
        naoUsados: Math.max(0, s.included_uses - usados),
        valorPorUso: valorPorUsoCents / 100,
        aRepassar: (usados * valorPorUsoCents) / 100,
        sobra: sobraCents / 100,
        fimDoCiclo: s.current_period_end,
        vencida: s.is_expired,
        destino: (plano?.leftover_destination as string) ?? 'barbearia',
      };
    })
    .sort((a, b) => b.sobra - a.sobra);

  // KPIs: mesma fonte que o dashboard, para as duas telas contarem igual
  const kpisSubs = subscriptionKpis(
    subscriptions.map((s) => ({
      status: s.status,
      current_price: s.plan_price,
      current_period_end: s.current_period_end,
      period: s.plan_period,
    }))
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* HEADER */}
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <p className="text-[10px] text-fg-dim tracking-[0.25em] uppercase mb-1">
            Clube de assinatura
          </p>
          <h1
            className="text-3xl text-fg font-bold"
            style={{ fontFamily: 'var(--font-playfair), serif' }}
          >
            Assinaturas
          </h1>
          <p className="text-sm text-fg-muted mt-2">
            Planos, assinantes, usos por ciclo e repasse dos barbeiros.
          </p>
        </div>

        <Link
          href="/admin/assinaturas/planos/novo"
          className="btn-gold-shimmer flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>Novo plano</span>
        </Link>
      </div>

      <div className="divider-gold" />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-md bg-gold/10 text-gold">
              <Crown className="w-4 h-4" />
            </div>
            <p className="text-[10px] tracking-widest uppercase text-fg-muted">
              Planos ativos
            </p>
          </div>
          <p
            className="text-2xl font-bold text-fg"
            style={{ fontFamily: 'var(--font-playfair), serif' }}
          >
            {plans.filter((p) => p.active).length}
          </p>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-md bg-success/10 text-success">
              <Users className="w-4 h-4" />
            </div>
            <p className="text-[10px] tracking-widest uppercase text-fg-muted">
              Assinantes
            </p>
          </div>
          <p
            className="text-2xl font-bold text-success"
            style={{ fontFamily: 'var(--font-playfair), serif' }}
          >
            {kpisSubs.assinantes}
          </p>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-md bg-gold/10 text-gold">
              <TrendingUp className="w-4 h-4" />
            </div>
            <p className="text-[10px] tracking-widest uppercase text-fg-muted">
              MRR estimado
            </p>
          </div>
          <p
            className="text-2xl font-bold text-gold"
            style={{ fontFamily: 'var(--font-playfair), serif' }}
          >
            {formatCurrency(kpisSubs.mrr)}
          </p>
          <p className="text-[10px] text-fg-subtle mt-1">
            Receita recorrente mensal
          </p>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2">
            <div
              className={`p-2 rounded-md ${
                kpisSubs.inadimplentes > 0
                  ? 'bg-danger/10 text-danger'
                  : 'bg-info/10 text-info'
              }`}
            >
              <AlertTriangle className="w-4 h-4" />
            </div>
            <p className="text-[10px] tracking-widest uppercase text-fg-muted">
              Inadimplentes
            </p>
          </div>
          <p
            className={`text-2xl font-bold ${
              kpisSubs.inadimplentes > 0 ? 'text-danger' : 'text-fg'
            }`}
            style={{ fontFamily: 'var(--font-playfair), serif' }}
          >
            {kpisSubs.inadimplentes}
          </p>
          <p className="text-[10px] text-fg-subtle mt-1">
            atrasadas ou com ciclo vencido
          </p>
        </div>
      </div>

      {/* SOBRA DAS ASSINATURAS */}
      <SobrasSection sobras={sobrasEmAberto} fechados={payouts} />

      {/* TABS: PLANOS / ASSINANTES / REPASSES */}
      <AssinaturasView
        plans={plans}
        subscriptions={subscriptions}
        payouts={payouts}
        customers={(allCustomers ?? []).map((c) => ({
          id: c.id as string,
          full_name: c.full_name as string,
          phone: (c.phone as string) ?? null,
        }))}
      />
    </div>
  );
}
