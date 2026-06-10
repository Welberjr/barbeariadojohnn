import { createAdminClient } from '@/lib/supabase/admin';
import { Target, TrendingUp, Crown } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { GoalsManager } from './_components/goals-manager';

const BARBERSHOP_ID = '11111111-1111-1111-1111-111111111111';

export const metadata = { title: 'Metas' };

type Status = 'critico' | 'ruim' | 'atencao' | 'excelente';

function getStatus(pct: number): Status {
  if (pct < 20) return 'critico';
  if (pct < 50) return 'ruim';
  if (pct < 80) return 'atencao';
  return 'excelente';
}

const STATUS_CONFIG: Record<Status, { label: string; barColor: string; textColor: string }> = {
  critico: { label: 'Crítico', barColor: '#ef4444', textColor: 'text-danger' },
  ruim: { label: 'Ruim', barColor: '#f59e0b', textColor: 'text-warning' },
  atencao: { label: 'Atenção', barColor: '#eab308', textColor: 'text-yellow-400' },
  excelente: { label: 'Excelente', barColor: '#22c55e', textColor: 'text-success' },
};

function MetaBar({
  label,
  icon,
  current,
  target,
  isCurrency = false,
  suffix = '',
}: {
  label: string;
  icon: string;
  current: number;
  target: number;
  isCurrency?: boolean;
  suffix?: string;
}) {
  if (target <= 0) return null;
  const pct = Math.min(100, (current / target) * 100);
  const weekPct = Math.min(100, (current / (target * 0.25)) * 100); // estimativa semanal
  const status = getStatus(pct);
  const cfg = STATUS_CONFIG[status];

  const fmtVal = (v: number) =>
    isCurrency ? formatCurrency(v) : `${v}${suffix}`;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <p className="text-sm text-fg flex items-center gap-1.5">
          <span>{icon}</span>
          {label}
        </p>
        <div className="flex items-center gap-3 text-[11px]">
          <span className="text-fg-muted">
            Real <strong className="text-fg">{fmtVal(current)}</strong>
          </span>
          <span className="text-fg-subtle">
            Previsto <strong>{fmtVal(Math.round(target * weekPct / 100))}</strong> / <strong>{fmtVal(target)}</strong>
          </span>
        </div>
      </div>

      <div className="relative h-2.5 bg-bg-elevated border border-border/60 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: cfg.barColor }}
        />
        {/* Linha de previsto (25% do mês = semana 1) */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-fg-subtle/40"
          style={{ left: '25%' }}
        />
      </div>

      <div className="flex items-center justify-between text-[10px]">
        <span className={`uppercase tracking-wider font-semibold ${cfg.textColor}`}>
          {cfg.label}
        </span>
        <div className="flex items-center gap-3 text-fg-dim">
          <span>{pct.toFixed(0)}%</span>
          <span>{weekPct.toFixed(0)}% (prev)</span>
        </div>
      </div>
    </div>
  );
}

interface PageProps {
  searchParams: Promise<{ tab?: string }>;
}

export default async function MetasPage({ searchParams }: PageProps) {
  const { tab: tabParam } = await searchParams;
  void tabParam;
  const supabase = createAdminClient();

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const firstDay = new Date(currentYear, currentMonth - 1, 1).toISOString().split('T')[0];
  const lastDay = new Date(currentYear, currentMonth, 0).toISOString().split('T')[0];

  const [{ data: goalsRaw }, { data: staffRaw }, { data: comandasMonth }] = await Promise.all([
    supabase
      .from('goals')
      .select('id, staff_id, period_type, year, month, week, revenue_target, appointments_target, avg_ticket_target')
      .eq('barbershop_id', BARBERSHOP_ID)
      .in('period_type', ['month'])
      .eq('year', currentYear)
      .eq('month', currentMonth),
    supabase
      .from('staff')
      .select('id, display_name, role')
      .eq('active', true)
      .in('role', ['barber', 'owner', 'manager'])
      .order('display_name'),
    supabase
      .from('comandas')
      .select('id, total, staff_id')
      .eq('barbershop_id', BARBERSHOP_ID)
      .eq('status', 'closed')
      .gte('closed_at', `${firstDay}T00:00:00.000-03:00`)
      .lte('closed_at', `${lastDay}T23:59:59.999-03:00`),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const goals = (goalsRaw ?? []) as any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const staff = (staffRaw ?? []) as any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const comandas = (comandasMonth ?? []) as any[];

  const totalBarbershop = comandas.reduce((s, c) => s + Number(c.total ?? 0), 0);
  const totalAppts = comandas.length;
  const avgTicket = totalAppts > 0 ? totalBarbershop / totalAppts : 0;

  const revenueByStaff = new Map<string, number>();
  const apptsByStaff = new Map<string, number>();
  for (const c of comandas) {
    const sid = c.staff_id as string | null;
    if (!sid) continue;
    revenueByStaff.set(sid, (revenueByStaff.get(sid) ?? 0) + Number(c.total ?? 0));
    apptsByStaff.set(sid, (apptsByStaff.get(sid) ?? 0) + 1);
  }

  const barbershopGoal = goals.find((g) => g.staff_id === null);
  const staffGoals = goals.filter((g) => g.staff_id !== null);

  const monthLabel = new Date(currentYear, currentMonth - 1).toLocaleString('pt-BR', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* HEADER */}
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <p className="text-[10px] text-fg-dim tracking-[0.25em] uppercase mb-1">Financeiro</p>
          <h1 className="text-3xl text-fg font-bold" style={{ fontFamily: 'var(--font-playfair), serif' }}>
            Metas e Desempenho
          </h1>
          <p className="text-sm text-fg-muted mt-2">
            Acompanhe e gerencie metas da barbearia e profissionais
          </p>
        </div>
        <p className="text-sm text-fg-muted capitalize">{monthLabel}</p>
      </div>

      <div className="divider-gold" />

      {/* META DA BARBEARIA */}
      <section className="card p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-gold/10 text-gold flex items-center justify-center">
              <Crown className="w-4 h-4" />
            </div>
            <h2 className="text-lg font-semibold text-fg" style={{ fontFamily: 'var(--font-playfair), serif' }}>
              Metas da Barbearia
            </h2>
          </div>
        </div>

        {barbershopGoal ? (
          <div className="space-y-5">
            <MetaBar
              label="Faturamento"
              icon="$"
              current={totalBarbershop}
              target={Number(barbershopGoal.revenue_target)}
              isCurrency
            />
            {Number(barbershopGoal.appointments_target ?? 0) > 0 && (
              <MetaBar
                label="Atendimentos"
                icon="✂"
                current={totalAppts}
                target={Number(barbershopGoal.appointments_target)}
                suffix=" atend."
              />
            )}
          </div>
        ) : (
          <div className="p-4 rounded-md bg-bg-elevated border border-dashed border-border">
            <p className="text-sm text-fg-subtle">
              Nenhuma meta definida para este mês. Use o formulário abaixo para criar uma meta.
            </p>
          </div>
        )}
      </section>

      {/* DESEMPENHO POR PROFISSIONAL */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-md bg-gold/10 text-gold flex items-center justify-center">
            <Target className="w-4 h-4" />
          </div>
          <h2 className="text-lg font-semibold text-fg" style={{ fontFamily: 'var(--font-playfair), serif' }}>
            Desempenho por Profissional
          </h2>
        </div>

        {staff.map((s) => {
          const goal = staffGoals.find((g) => g.staff_id === s.id);
          const revenue = revenueByStaff.get(s.id as string) ?? 0;
          const appts = apptsByStaff.get(s.id as string) ?? 0;
          const ticket = appts > 0 ? revenue / appts : 0;

          const revTarget = Number(goal?.revenue_target ?? 0);
          const apptTarget = Number(goal?.appointments_target ?? 0);
          const ticketTarget = Number(goal?.avg_ticket_target ?? 0);

          return (
            <div key={s.id} className="card p-5 space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-md bg-gold/10 text-gold flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold">✂</span>
                </div>
                <h3 className="text-base font-semibold text-fg">{s.display_name}</h3>
              </div>

              {revTarget > 0 ? (
                <div className="space-y-4">
                  <MetaBar label="Faturamento" icon="$" current={revenue} target={revTarget} isCurrency />
                  {apptTarget > 0 && (
                    <MetaBar label="Atendimentos" icon="✂" current={appts} target={apptTarget} suffix=" atend." />
                  )}
                  {ticketTarget > 0 && (
                    <MetaBar label="Ticket Médio" icon="↑" current={ticket} target={ticketTarget} isCurrency />
                  )}
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="text-xs text-fg-subtle">
                    Sem meta definida. Atual:{' '}
                    <strong className="text-fg">{formatCurrency(revenue)}</strong>
                    {appts > 0 && (
                      <> · {appts} atendimentos · Ticket: {formatCurrency(ticket)}</>
                    )}
                  </p>
                  <div className="flex items-center gap-2 text-[10px] text-fg-dim">
                    <TrendingUp className="w-3 h-3" />
                    <span>Defina uma meta no formulário abaixo</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
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
          staff_name: g.staff_id
            ? (staff.find((s) => s.id === g.staff_id)?.display_name ?? null)
            : null,
        }))}
      />
    </div>
  );
}
