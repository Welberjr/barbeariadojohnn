import { createClient } from '@/lib/supabase/server';
import { Target, TrendingUp, Crown } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { GoalsManager } from './_components/goals-manager';

const BARBERSHOP_ID = '11111111-1111-1111-1111-111111111111';

export const metadata = {
  title: 'Metas',
};

interface Goal {
  id: string;
  staff_id: string | null;
  period_type: string;
  year: number;
  month: number | null;
  week: number | null;
  revenue_target: number;
}

export default async function MetasPage() {
  const supabase = await createClient();

  // Período atual
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-12

  // Buscar metas do mês corrente
  const { data: goalsRaw } = await supabase
    .from('goals')
    .select('id, staff_id, period_type, year, month, week, revenue_target')
    .eq('barbershop_id', BARBERSHOP_ID)
    .eq('period_type', 'month')
    .eq('year', currentYear)
    .eq('month', currentMonth);

  const goals = (goalsRaw ?? []) as Goal[];

  // Buscar staff
  const { data: staffRaw } = await supabase
    .from('staff')
    .select('id, display_name, role')
    .eq('active', true)
    .in('role', ['barber', 'owner', 'manager'])
    .order('display_name');

  const staff = staffRaw ?? [];
  const staffMap = new Map(
    staff.map((s) => [s.id as string, s.display_name as string])
  );

  // Calcular receita do mês atual por staff (e total da barbearia)
  const firstDay = new Date(currentYear, currentMonth - 1, 1)
    .toISOString()
    .split('T')[0];
  const lastDay = new Date(currentYear, currentMonth, 0)
    .toISOString()
    .split('T')[0];

  const { data: comandasMonth } = await supabase
    .from('comandas')
    .select('id, total, staff_id')
    .eq('barbershop_id', BARBERSHOP_ID)
    .eq('status', 'closed')
    .gte('closed_at', `${firstDay}T00:00:00.000-03:00`)
    .lte('closed_at', `${lastDay}T23:59:59.999-03:00`);

  const totalBarbershop = (comandasMonth ?? []).reduce(
    (s, c) => s + Number(c.total ?? 0),
    0
  );
  const revenueByStaff = new Map<string, number>();
  for (const c of comandasMonth ?? []) {
    const sid = c.staff_id as string | null;
    if (!sid) continue;
    revenueByStaff.set(sid, (revenueByStaff.get(sid) ?? 0) + Number(c.total ?? 0));
  }

  // Goal da barbearia
  const barbershopGoal = goals.find((g) => g.staff_id === null);

  // Metas individuais (por staff)
  const staffGoals = goals.filter((g) => g.staff_id !== null);

  const monthLabel = new Date(currentYear, currentMonth - 1, 1).toLocaleString(
    'pt-BR',
    { month: 'long', year: 'numeric' }
  );

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl">
      {/* HEADER */}
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <p className="text-[10px] text-fg-dim tracking-[0.25em] uppercase mb-1">
            Financeiro
          </p>
          <h1
            className="text-3xl text-fg font-bold"
            style={{ fontFamily: 'var(--font-playfair), serif' }}
          >
            Metas
          </h1>
          <p className="text-sm text-fg-muted mt-2">
            Acompanhamento de metas mensais e progresso por profissional.
          </p>
        </div>
        <p className="text-sm text-fg-muted capitalize">{monthLabel}</p>
      </div>

      <div className="divider-gold" />

      {/* META DA BARBEARIA */}
      <section className="card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Crown className="w-4 h-4 text-gold" />
          <h2
            className="text-lg font-semibold text-fg"
            style={{ fontFamily: 'var(--font-playfair), serif' }}
          >
            Meta da Barbearia
          </h2>
        </div>

        {barbershopGoal ? (
          <ProgressCard
            target={Number(barbershopGoal.revenue_target)}
            current={totalBarbershop}
            label="Faturamento total do mês"
          />
        ) : (
          <div className="p-4 rounded-md bg-bg-elevated border border-dashed border-border">
            <p className="text-sm text-fg-subtle">
              Nenhuma meta definida para este mês. Use o formulário abaixo para
              criar uma meta.
            </p>
          </div>
        )}
      </section>

      {/* METAS POR PROFISSIONAL */}
      <section className="card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Target className="w-4 h-4 text-gold" />
          <h2
            className="text-lg font-semibold text-fg"
            style={{ fontFamily: 'var(--font-playfair), serif' }}
          >
            Metas por Profissional
          </h2>
        </div>

        {staff.length === 0 ? (
          <p className="text-sm text-fg-subtle py-4">
            Nenhum profissional cadastrado.
          </p>
        ) : (
          <div className="space-y-3">
            {staff.map((s) => {
              const goal = staffGoals.find((g) => g.staff_id === s.id);
              const current = revenueByStaff.get(s.id as string) ?? 0;
              return (
                <div
                  key={s.id}
                  className="p-4 rounded-md bg-bg-elevated border border-border/60"
                >
                  <p className="text-sm font-medium text-fg mb-2">
                    {s.display_name}
                  </p>
                  {goal ? (
                    <ProgressCard
                      target={Number(goal.revenue_target)}
                      current={current}
                      compact
                    />
                  ) : (
                    <p className="text-xs text-fg-subtle">
                      Sem meta definida. Atual:{' '}
                      <strong>{formatCurrency(current)}</strong>
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* FORMULÁRIO DE META */}
      <GoalsManager
        staff={staff.map((s) => ({
          id: s.id as string,
          display_name: s.display_name as string,
        }))}
        currentYear={currentYear}
        currentMonth={currentMonth}
        existingGoals={goals.map((g) => ({
          id: g.id,
          staff_id: g.staff_id,
          revenue_target: Number(g.revenue_target),
          staff_name: g.staff_id ? staffMap.get(g.staff_id) ?? null : null,
        }))}
      />
    </div>
  );
}

function ProgressCard({
  target,
  current,
  label,
  compact,
}: {
  target: number;
  current: number;
  label?: string;
  compact?: boolean;
}) {
  const pct = target > 0 ? Math.min((current / target) * 100, 100) : 0;
  const remaining = Math.max(0, target - current);
  const reached = current >= target;

  return (
    <div className={compact ? '' : 'space-y-3'}>
      {label && !compact && (
        <p className="text-[11px] text-fg-subtle">{label}</p>
      )}
      <div className="flex items-baseline justify-between gap-2 mb-2">
        <p
          className={`${
            compact ? 'text-base' : 'text-2xl'
          } font-bold text-fg`}
          style={{ fontFamily: 'var(--font-playfair), serif' }}
        >
          {formatCurrency(current)}
          <span className="text-fg-subtle font-normal text-sm ml-2">
            de {formatCurrency(target)}
          </span>
        </p>
        <p
          className={`text-sm font-bold ${
            reached ? 'text-success' : 'text-gold'
          }`}
        >
          {pct.toFixed(0)}%
        </p>
      </div>
      <div className="w-full h-2 bg-bg-deep rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            reached
              ? 'bg-gradient-to-r from-success to-success-glow'
              : 'bg-gradient-to-r from-gold to-gold-shimmer'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {!reached && !compact && (
        <p className="text-[11px] text-fg-subtle flex items-center gap-1">
          <TrendingUp className="w-3 h-3" />
          Faltam <strong>{formatCurrency(remaining)}</strong> para bater a meta
        </p>
      )}
      {reached && !compact && (
        <p className="text-[11px] text-success font-medium">
          🎯 Meta batida! Superou em {formatCurrency(current - target)}
        </p>
      )}
    </div>
  );
}
