import { createAdminClient } from '@/lib/supabase/admin';
import Link from 'next/link';
import {
  Target,
  TrendingUp,
  Crown,
  Scissors,
  CircleDollarSign,
  Gauge,
  Pencil,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { GoalsManager } from './_components/goals-manager';
import { InfoTip } from '@/components/info-tip';

const BARBERSHOP_ID = '11111111-1111-1111-1111-111111111111';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Metas' };

type Status = 'critico' | 'atencao' | 'bom' | 'superado';

const STATUS_CONFIG: Record<
  Status,
  { label: string; bar: string; chip: string; dot: string }
> = {
  critico: {
    label: 'Crítico',
    bar: 'linear-gradient(90deg, #b91c1c, #ef4444)',
    chip: 'bg-danger/15 text-danger border-danger/30',
    dot: 'bg-danger',
  },
  atencao: {
    label: 'Atenção',
    bar: 'linear-gradient(90deg, #b45309, #f59e0b)',
    chip: 'bg-warning/15 text-warning border-warning/30',
    dot: 'bg-warning',
  },
  bom: {
    label: 'Bom',
    bar: 'linear-gradient(90deg, #B8862A, #F5C518)',
    chip: 'bg-gold/15 text-gold border-gold/30',
    dot: 'bg-gold',
  },
  superado: {
    label: 'Superado',
    bar: 'linear-gradient(90deg, #15803d, #22c55e)',
    chip: 'bg-success/15 text-success border-success/30',
    dot: 'bg-success',
  },
};

function getStatus(current: number, target: number, elapsedRatio: number): Status {
  if (target <= 0) return 'bom';
  if (current >= target) return 'superado';
  const expected = target * elapsedRatio;
  if (expected <= 0) return 'bom';
  const pace = current / expected;
  if (pace >= 0.9) return 'bom';
  if (pace >= 0.6) return 'atencao';
  return 'critico';
}

function MetaBar({
  label,
  icon,
  current,
  target,
  elapsedRatio,
  isCurrency = false,
}: {
  label: string;
  icon: React.ReactNode;
  current: number;
  target: number;
  elapsedRatio: number;
  isCurrency?: boolean;
}) {
  if (target <= 0) return null;

  const pct = Math.min(100, (current / target) * 100);
  const projected = elapsedRatio > 0.02 ? current / elapsedRatio : current;
  const projectedPct = Math.min(100, (projected / target) * 100);
  const status = getStatus(current, target, elapsedRatio);
  const cfg = STATUS_CONFIG[status];

  const fmt = (v: number) =>
    isCurrency ? formatCurrency(v) : String(Math.round(v));

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-fg flex items-center gap-1.5 font-medium">
          <span className="text-gold">{icon}</span>
          {label}
        </p>
        <div className="flex items-center gap-2 text-[11px] flex-wrap">
          <span className="px-1.5 py-0.5 rounded bg-bg-elevated border border-border/60 text-fg-muted uppercase text-[9px] tracking-wider">
            Real
          </span>
          <strong className="text-fg text-xs">{fmt(current)}</strong>
          <span className="text-fg-dim">|</span>
          <span className="px-1.5 py-0.5 rounded bg-bg-elevated border border-border/60 text-fg-muted uppercase text-[9px] tracking-wider">
            Previsto
          </span>
          <strong className="text-fg-muted text-xs">{fmt(projected)}</strong>
          <span className="text-fg-subtle text-xs">/ {fmt(target)}</span>
        </div>
      </div>

      <div className="relative h-2.5 bg-bg-elevated border border-border/60 rounded-full overflow-hidden">
        {/* Projecao (fantasma) */}
        <div
          className="absolute inset-y-0 left-0 rounded-full opacity-25"
          style={{ width: `${projectedPct}%`, background: cfg.bar }}
        />
        {/* Realizado */}
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all"
          style={{ width: `${pct}%`, background: cfg.bar }}
        />
        {/* Marcador: onde deveria estar hoje */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-fg/50"
          style={{ left: `${Math.min(99.5, elapsedRatio * 100)}%` }}
          title="Esperado para hoje"
        />
      </div>

      <div className="flex items-center justify-between text-[10px]">
        <span
          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border uppercase tracking-wider font-semibold ${cfg.chip}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
          {cfg.label}
        </span>
        <div className="flex items-center gap-2 text-fg-muted">
          <span className="px-1.5 py-0.5 rounded-full bg-bg-elevated border border-border/60 font-semibold">
            {pct.toFixed(0)}%
          </span>
          <span className="px-1.5 py-0.5 rounded-full bg-bg-elevated border border-border/40 text-fg-subtle">
            {projectedPct.toFixed(0)}% prev.
          </span>
        </div>
      </div>
    </div>
  );
}

interface PageProps {
  searchParams: Promise<{ staff?: string }>;
}

export default async function MetasPage({ searchParams }: PageProps) {
  const { staff: staffParam } = await searchParams;
  const supabase = createAdminClient();

  const now = new Date();
  const spDate = now.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  const currentYear = Number(spDate.slice(0, 4));
  const currentMonth = Number(spDate.slice(5, 7));
  const dayOfMonth = Number(spDate.slice(8, 10));
  const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
  const elapsedRatio = Math.min(1, dayOfMonth / daysInMonth);

  const firstDay = `${spDate.slice(0, 8)}01`;
  const lastDay = new Date(currentYear, currentMonth, 0).toISOString().split('T')[0];

  const [{ data: goalsRaw }, { data: staffRaw }, { data: comandasMonth }] =
    await Promise.all([
      supabase
        .from('goals')
        .select(
          'id, staff_id, period_type, year, month, week, revenue_target, appointments_target, avg_ticket_target'
        )
        .eq('barbershop_id', BARBERSHOP_ID)
        .in('period_type', ['monthly', 'month'])
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

  const sortedStaff = [...staff].sort((a, b) =>
    String(a.display_name).localeCompare(String(b.display_name), 'pt-BR', {
      sensitivity: 'base',
    })
  );
  return (
    <div className="space-y-6 animate-fade-in">
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
            Metas e Desempenho
          </h1>
          <p className="text-sm text-fg-muted mt-2">
            Acompanhe e gerencie metas da barbearia e profissionais
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-fg-muted capitalize">{monthLabel}</p>
          <p className="text-[11px] text-fg-subtle">
            Dia {dayOfMonth} de {daysInMonth} · {(elapsedRatio * 100).toFixed(0)}% do mês
          </p>
        </div>
      </div>

      <div className="divider-gold" />

      {/* META DA BARBEARIA */}
      <section className="card-premium p-6 space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-gold/10 text-gold flex items-center justify-center">
              <Crown className="w-4 h-4" />
            </div>
            <h2
              className="text-lg font-semibold text-fg"
              style={{ fontFamily: 'var(--font-playfair), serif' }}
            >
              Metas da Barbearia <InfoTip text="Meta consolidada do mês. REAL é o que já entrou; PREVISTO é a projeção mantendo o ritmo atual; o traço na barra marca onde você deveria estar hoje." />
            </h2>
          </div>
          <Link
            href="/admin/metas?staff=shop#form-meta"
            className="btn-ghost text-xs flex items-center gap-1.5 border border-border hover:border-gold/40"
          >
            <Pencil className="w-3 h-3" />
            <span>{barbershopGoal ? 'Editar' : 'Definir meta'}</span>
          </Link>
        </div>

        {barbershopGoal ? (
          <div className="space-y-5">
            <MetaBar
              label="Faturamento"
              icon={<CircleDollarSign className="w-3.5 h-3.5" />}
              current={totalBarbershop}
              target={Number(barbershopGoal.revenue_target)}
              elapsedRatio={elapsedRatio}
              isCurrency
            />
            {Number(barbershopGoal.appointments_target ?? 0) > 0 && (
              <MetaBar
                label="Atendimentos"
                icon={<Scissors className="w-3.5 h-3.5" />}
                current={totalAppts}
                target={Number(barbershopGoal.appointments_target)}
                elapsedRatio={elapsedRatio}
              />
            )}
          </div>
        ) : (
          <div className="p-4 rounded-md bg-bg-elevated border border-dashed border-border">
            <p className="text-sm text-fg-subtle">
              Nenhuma meta definida para {monthLabel}. Clique em &quot;Definir
              meta&quot; para acompanhar o progresso da barbearia aqui.
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
          <h2
            className="text-lg font-semibold text-fg"
            style={{ fontFamily: 'var(--font-playfair), serif' }}
          >
            Desempenho por Profissional <InfoTip text="Resultado individual no mês. O status (Crítico, Atenção, Bom, Superado) compara o realizado com o esperado para o dia de hoje, não com a meta cheia." />
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {sortedStaff.map((s) => {
            const goal = staffGoals.find((g) => g.staff_id === s.id);
            const revenue = revenueByStaff.get(s.id as string) ?? 0;
            const appts = apptsByStaff.get(s.id as string) ?? 0;
            const ticket = appts > 0 ? revenue / appts : 0;

            const revTarget = Number(goal?.revenue_target ?? 0);
            const apptTarget = Number(goal?.appointments_target ?? 0);
            const ticketTarget = Number(goal?.avg_ticket_target ?? 0);

            const initials = String(s.display_name ?? '?')
              .split(' ')
              .map((n: string) => n[0])
              .join('')
              .slice(0, 2)
              .toUpperCase();

            return (
              <div key={s.id} className="card p-5 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-bg flex-shrink-0"
                      style={{
                        background:
                          'linear-gradient(135deg, #D4A04F 0%, #F5C518 100%)',
                      }}
                    >
                      {initials}
                    </div>
                    <h3 className="text-base font-semibold text-fg truncate">
                      {s.display_name}
                    </h3>
                  </div>
                  <Link
                    href={`/admin/metas?staff=${s.id}#form-meta`}
                    className="btn-ghost text-xs flex items-center gap-1.5 border border-border hover:border-gold/40 flex-shrink-0"
                  >
                    <Pencil className="w-3 h-3" />
                    <span>{revTarget > 0 ? 'Editar' : 'Definir meta'}</span>
                  </Link>
                </div>

                {revTarget > 0 ? (
                  <div className="space-y-4">
                    <MetaBar
                      label="Faturamento"
                      icon={<CircleDollarSign className="w-3.5 h-3.5" />}
                      current={revenue}
                      target={revTarget}
                      elapsedRatio={elapsedRatio}
                      isCurrency
                    />
                    {apptTarget > 0 && (
                      <MetaBar
                        label="Atendimentos"
                        icon={<Scissors className="w-3.5 h-3.5" />}
                        current={appts}
                        target={apptTarget}
                        elapsedRatio={elapsedRatio}
                      />
                    )}
                    {ticketTarget > 0 && (
                      <MetaBar
                        label="Ticket Médio"
                        icon={<Gauge className="w-3.5 h-3.5" />}
                        current={ticket}
                        target={ticketTarget}
                        elapsedRatio={1}
                        isCurrency
                      />
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2 pt-1">
                    <div className="p-2.5 rounded-md bg-bg-elevated border border-border/50">
                      <p className="text-[9px] uppercase tracking-wider text-fg-dim">
                        Faturado
                      </p>
                      <p className="text-sm font-bold text-gold">
                        {formatCurrency(revenue)}
                      </p>
                    </div>
                    <div className="p-2.5 rounded-md bg-bg-elevated border border-border/50">
                      <p className="text-[9px] uppercase tracking-wider text-fg-dim">
                        Atendim.
                      </p>
                      <p className="text-sm font-bold text-fg">{appts}</p>
                    </div>
                    <div className="p-2.5 rounded-md bg-bg-elevated border border-border/50">
                      <p className="text-[9px] uppercase tracking-wider text-fg-dim">
                        Ticket
                      </p>
                      <p className="text-sm font-bold text-fg">
                        {formatCurrency(ticket)}
                      </p>
                    </div>
                    <p className="col-span-3 flex items-center gap-1.5 text-[10px] text-fg-subtle">
                      <TrendingUp className="w-3 h-3" />
                      Sem meta definida para este mês
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* FORMULÁRIO DE META */}
      <GoalsManager
        staff={sortedStaff.map((s) => ({
          id: s.id as string,
          display_name: s.display_name as string,
        }))}
        currentYear={currentYear}
        currentMonth={currentMonth}
        initialStaffId={staffParam === 'shop' ? '' : (staffParam ?? null)}
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