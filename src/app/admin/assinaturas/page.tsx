import { createClient } from '@/lib/supabase/server';
import {
  Crown,
  Plus,
  Users,
  TrendingUp,
  CheckCircle2,
} from 'lucide-react';
import Link from 'next/link';
import { formatCurrency } from '@/lib/utils';
import { AssinaturasView } from './_components/assinaturas-view';

const BARBERSHOP_ID = '11111111-1111-1111-1111-111111111111';

export const metadata = {
  title: 'Assinaturas',
};

interface Plan {
  id: string;
  name: string;
  description: string | null;
  price: number;
  billing_cycle: string;
  includes_services: string[] | null;
  includes_count: number;
  discount_percent_on_extras: number;
  active: boolean;
  display_order: number;
}

interface Subscription {
  id: string;
  customer_id: string;
  plan_id: string;
  status: string;
  started_at: string;
  current_period_start: string;
  current_period_end: string;
  cancelled_at: string | null;
  remaining_uses: number;
  notes: string | null;
}

export default async function AssinaturasPage() {
  const supabase = await createClient();

  // Planos
  const { data: plansRaw } = await supabase
    .from('subscription_plans')
    .select('*')
    .eq('barbershop_id', BARBERSHOP_ID)
    .order('display_order')
    .order('name');

  const plans = (plansRaw ?? []) as Plan[];

  // Assinaturas
  const { data: subsRaw } = await supabase
    .from('customer_subscriptions')
    .select('*')
    .eq('barbershop_id', BARBERSHOP_ID)
    .order('status')
    .order('current_period_end', { ascending: false });

  const subs = (subsRaw ?? []) as Subscription[];

  // Clientes (para mostrar nomes)
  const customerIds = Array.from(new Set(subs.map((s) => s.customer_id)));
  const { data: customersRaw } =
    customerIds.length > 0
      ? await supabase
          .from('customers')
          .select('id, full_name, phone')
          .in('id', customerIds)
      : { data: [] };

  const customerMap = new Map(
    (customersRaw ?? []).map((c) => [
      c.id as string,
      {
        full_name: c.full_name as string,
        phone: (c.phone as string) ?? null,
      },
    ])
  );

  // Todos os clientes (pra dropdown)
  const { data: allCustomers } = await supabase
    .from('customers')
    .select('id, full_name, phone')
    .eq('barbershop_id', BARBERSHOP_ID)
    .eq('active', true)
    .order('full_name')
    .limit(500);

  // KPIs
  const activeSubs = subs.filter((s) => s.status === 'active');
  const planMap = new Map(plans.map((p) => [p.id, p]));

  let mrr = 0; // Monthly Recurring Revenue
  for (const sub of activeSubs) {
    const plan = planMap.get(sub.plan_id);
    if (plan) {
      const price = Number(plan.price);
      if (plan.billing_cycle === 'monthly') mrr += price;
      else if (plan.billing_cycle === 'yearly') mrr += price / 12;
      else if (plan.billing_cycle === 'weekly') mrr += price * 4.33;
    }
  }

  const cancelledThisMonth = (() => {
    const firstOfMonth = new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      1
    );
    return subs.filter(
      (s) =>
        s.status === 'cancelled' &&
        s.cancelled_at &&
        new Date(s.cancelled_at) >= firstOfMonth
    ).length;
  })();

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl">
      {/* HEADER */}
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <p className="text-[10px] text-fg-dim tracking-[0.25em] uppercase mb-1">
            Marketing
          </p>
          <h1
            className="text-3xl text-fg font-bold"
            style={{ fontFamily: 'var(--font-playfair), serif' }}
          >
            Assinaturas
          </h1>
          <p className="text-sm text-fg-muted mt-2">
            Planos mensais e assinantes ativos.
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
            {activeSubs.length}
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
            {formatCurrency(mrr)}
          </p>
          <p className="text-[10px] text-fg-subtle mt-1">
            Receita recorrente mensal
          </p>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2">
            <div
              className={`p-2 rounded-md ${
                cancelledThisMonth > 0
                  ? 'bg-danger/10 text-danger'
                  : 'bg-info/10 text-info'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <p className="text-[10px] tracking-widest uppercase text-fg-muted">
              Churn no mês
            </p>
          </div>
          <p
            className={`text-2xl font-bold ${
              cancelledThisMonth > 0 ? 'text-danger' : 'text-fg'
            }`}
            style={{ fontFamily: 'var(--font-playfair), serif' }}
          >
            {cancelledThisMonth}
          </p>
          <p className="text-[10px] text-fg-subtle mt-1">cancelamentos</p>
        </div>
      </div>

      {/* TABS: PLANOS / ASSINANTES */}
      <AssinaturasView
        plans={plans}
        subscriptions={subs.map((s) => {
          const c = customerMap.get(s.customer_id);
          const p = planMap.get(s.plan_id);
          return {
            ...s,
            customer_name: c?.full_name ?? 'Cliente removido',
            customer_phone: c?.phone ?? null,
            plan_name: p?.name ?? 'Plano removido',
            plan_price: p ? Number(p.price) : 0,
          };
        })}
        customers={(allCustomers ?? []).map((c) => ({
          id: c.id as string,
          full_name: c.full_name as string,
          phone: (c.phone as string) ?? null,
        }))}
      />
    </div>
  );
}
