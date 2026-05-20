import { createClient } from '@/lib/supabase/server';
import {
  Trophy,
  Users,
  TrendingUp,
  Gift,
  Sparkles,
} from 'lucide-react';
import { FidelidadeView } from './_components/fidelidade-view';

const BARBERSHOP_ID = '11111111-1111-1111-1111-111111111111';

export const metadata = {
  title: 'Programa de Fidelidade',
};

interface Reward {
  id: string;
  name: string;
  description: string | null;
  points_required: number;
  reward_type: string;
  reward_value: number | null;
  service_id: string | null;
  product_id: string | null;
  active: boolean;
  display_order: number;
}

interface LoyaltyPoint {
  customer_id: string;
  balance: number;
  lifetime_earned: number;
  lifetime_redeemed: number;
}

interface Transaction {
  id: string;
  customer_id: string;
  type: string;
  points: number;
  reason: string | null;
  created_at: string;
}

export default async function FidelidadePage() {
  const supabase = await createClient();

  // Config da barbearia
  const { data: bs } = await supabase
    .from('barbershops')
    .select('loyalty_enabled, loyalty_points_per_brl')
    .eq('id', BARBERSHOP_ID)
    .maybeSingle();

  const loyaltyEnabled = bs?.loyalty_enabled ?? false;
  const pointsPerBrl = Number(bs?.loyalty_points_per_brl ?? 1);

  // Prêmios
  const { data: rewardsRaw } = await supabase
    .from('loyalty_rewards')
    .select('*')
    .eq('barbershop_id', BARBERSHOP_ID)
    .order('display_order')
    .order('points_required');

  const rewards = (rewardsRaw ?? []) as Reward[];

  // Serviços e produtos pra dropdown de prêmios
  const { data: services } = await supabase
    .from('services')
    .select('id, name')
    .eq('barbershop_id', BARBERSHOP_ID)
    .eq('active', true)
    .order('name');

  const { data: products } = await supabase
    .from('products')
    .select('id, name')
    .eq('barbershop_id', BARBERSHOP_ID)
    .eq('active', true)
    .order('name');

  // Saldos
  const { data: pointsRaw } = await supabase
    .from('loyalty_points')
    .select('customer_id, balance, lifetime_earned, lifetime_redeemed')
    .eq('barbershop_id', BARBERSHOP_ID)
    .order('balance', { ascending: false });

  const points = (pointsRaw ?? []) as LoyaltyPoint[];

  // Clientes referenciados
  const customerIds = Array.from(new Set(points.map((p) => p.customer_id)));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let customersData: any[] = [];
  if (customerIds.length > 0) {
    const { data: cs } = await supabase
      .from('customers')
      .select('id, full_name, phone')
      .in('id', customerIds);
    customersData = cs ?? [];
  }
  const customerMap = new Map<string, { name: string; phone: string | null }>(
    customersData.map((c) => [
      c.id as string,
      { name: c.full_name as string, phone: ((c.phone as string | null) ?? null) },
    ])
  );

  // Todos os clientes (pra ajuste de pontos)
  const { data: allCustomers } = await supabase
    .from('customers')
    .select('id, full_name, phone')
    .eq('barbershop_id', BARBERSHOP_ID)
    .eq('active', true)
    .order('full_name')
    .limit(500);

  // Histórico recente de transações
  const { data: txRaw } = await supabase
    .from('loyalty_transactions')
    .select('id, customer_id, type, points, reason, created_at')
    .eq('barbershop_id', BARBERSHOP_ID)
    .order('created_at', { ascending: false })
    .limit(50);

  const transactions = (txRaw ?? []) as Transaction[];

  // Nomes dos clientes nas transações (pode haver IDs fora do balanceMap)
  const txCustomerIds = Array.from(
    new Set(transactions.map((t) => t.customer_id).filter(Boolean))
  );
  const missingTxIds = txCustomerIds.filter((id) => !customerMap.has(id));
  if (missingTxIds.length > 0) {
    const { data: more } = await supabase
      .from('customers')
      .select('id, full_name')
      .in('id', missingTxIds);
    for (const c of more ?? []) {
      customerMap.set(c.id as string, {
        name: c.full_name as string,
        phone: null,
      });
    }
  }

  // KPIs
  const totalClientesComPontos = points.length;
  const totalPontosCirculacao = points.reduce(
    (s, p) => s + Number(p.balance ?? 0),
    0
  );
  const totalGanhoLifetime = points.reduce(
    (s, p) => s + Number(p.lifetime_earned ?? 0),
    0
  );
  const totalResgateLifetime = points.reduce(
    (s, p) => s + Number(p.lifetime_redeemed ?? 0),
    0
  );

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl">
      {/* HEADER */}
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <p className="text-[10px] text-fg-dim tracking-[0.25em] uppercase mb-1">
            Marketing
          </p>
          <h1
            className="text-3xl text-fg font-bold flex items-center gap-2"
            style={{ fontFamily: 'var(--font-playfair), serif' }}
          >
            <Trophy className="w-7 h-7 text-gold" />
            Programa de Fidelidade
          </h1>
          <p className="text-sm text-fg-muted mt-2">
            Pontos por compra + prêmios resgatáveis para fidelizar clientes.
          </p>
        </div>

        <div
          className={`badge-${
            loyaltyEnabled ? 'success' : 'gold'
          } text-[11px]`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              loyaltyEnabled
                ? 'bg-success animate-pulse'
                : 'bg-gold'
            }`}
          />
          <span>{loyaltyEnabled ? 'Ativo' : 'Inativo'}</span>
        </div>
      </div>

      <div className="divider-gold" />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-md bg-gold/10 text-gold">
              <Users className="w-4 h-4" />
            </div>
            <p className="text-[10px] tracking-widest uppercase text-fg-muted">
              Clientes
            </p>
          </div>
          <p
            className="text-2xl font-bold text-fg"
            style={{ fontFamily: 'var(--font-playfair), serif' }}
          >
            {totalClientesComPontos}
          </p>
          <p className="text-[10px] text-fg-subtle mt-1">com pontos</p>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-md bg-gold/10 text-gold">
              <Sparkles className="w-4 h-4" />
            </div>
            <p className="text-[10px] tracking-widest uppercase text-fg-muted">
              Pontos em circulação
            </p>
          </div>
          <p
            className="text-2xl font-bold text-gold"
            style={{ fontFamily: 'var(--font-playfair), serif' }}
          >
            {totalPontosCirculacao.toLocaleString('pt-BR')}
          </p>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-md bg-success/10 text-success">
              <TrendingUp className="w-4 h-4" />
            </div>
            <p className="text-[10px] tracking-widest uppercase text-fg-muted">
              Total ganho
            </p>
          </div>
          <p
            className="text-2xl font-bold text-fg"
            style={{ fontFamily: 'var(--font-playfair), serif' }}
          >
            {totalGanhoLifetime.toLocaleString('pt-BR')}
          </p>
          <p className="text-[10px] text-fg-subtle mt-1">acumulado</p>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-md bg-info/10 text-info">
              <Gift className="w-4 h-4" />
            </div>
            <p className="text-[10px] tracking-widest uppercase text-fg-muted">
              Resgatado
            </p>
          </div>
          <p
            className="text-2xl font-bold text-fg"
            style={{ fontFamily: 'var(--font-playfair), serif' }}
          >
            {totalResgateLifetime.toLocaleString('pt-BR')}
          </p>
          <p className="text-[10px] text-fg-subtle mt-1">acumulado</p>
        </div>
      </div>

      {/* TABS */}
      <FidelidadeView
        loyaltyEnabled={loyaltyEnabled}
        pointsPerBrl={pointsPerBrl}
        rewards={rewards}
        services={(services ?? []).map((s) => ({
          id: s.id as string,
          name: s.name as string,
        }))}
        products={(products ?? []).map((p) => ({
          id: p.id as string,
          name: p.name as string,
        }))}
        balances={points.map((p) => ({
          customer_id: p.customer_id,
          customer_name: customerMap.get(p.customer_id)?.name ?? 'Cliente removido',
          customer_phone: customerMap.get(p.customer_id)?.phone ?? null,
          balance: Number(p.balance ?? 0),
          lifetime_earned: Number(p.lifetime_earned ?? 0),
          lifetime_redeemed: Number(p.lifetime_redeemed ?? 0),
        }))}
        customers={(allCustomers ?? []).map((c) => ({
          id: c.id as string,
          full_name: c.full_name as string,
          phone: ((c.phone as string | null) ?? null),
        }))}
        transactions={transactions.map((t) => ({
          ...t,
          customer_name:
            customerMap.get(t.customer_id)?.name ?? 'Cliente removido',
        }))}
      />
    </div>
  );
}
