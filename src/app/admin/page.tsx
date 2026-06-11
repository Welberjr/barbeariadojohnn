import {
  Calendar,
  Users,
  CircleDollarSign,
  Star,
  Scissors,
  Clock,
  ArrowUpRight,
  Zap,
  AlertTriangle,
  TrendingUp,
  Activity,
  Crown,
} from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import Link from 'next/link';
import { formatCurrency } from '@/lib/utils';
import { DashboardCharts } from './_components/dashboard-charts';

const BARBERSHOP_ID = '11111111-1111-1111-1111-111111111111';

export const dynamic = 'force-dynamic';

function getInsights(data: {
  cancelRate: number;
  peakHour: string;
  peakHourCount: number;
  busiestDay: string;
  busiestDayCount: number;
  avgTicket: number;
  completedCount: number;
  cancelledCount: number;
}) {
  const insights: Array<{
    icon: typeof Zap;
    title: string;
    desc: string;
    color: string;
    bg: string;
  }> = [];

  if (data.cancelRate > 15) {
    insights.push({
      icon: AlertTriangle,
      title: 'Taxa de Cancelamento Alta',
      desc: `${data.cancelRate.toFixed(1)}% dos atendimentos foram cancelados este mês. Considere implementar confirmações automáticas via WhatsApp.`,
      color: 'text-warning',
      bg: 'border-warning/30 bg-warning/5',
    });
  }

  if (data.peakHourCount > 0) {
    insights.push({
      icon: Clock,
      title: 'Horário de Pico Identificado',
      desc: `${data.peakHour}h é o horário mais movimentado com ${data.peakHourCount} atendimentos. Considere alocar mais profissionais neste período.`,
      color: 'text-info',
      bg: 'border-info/30 bg-info/5',
    });
  }

  if (data.busiestDayCount > 0) {
    insights.push({
      icon: TrendingUp,
      title: 'Dia Mais Movimentado',
      desc: `${data.busiestDay} é o dia com mais atendimentos (${data.busiestDayCount}). Garanta disponibilidade da equipe completa.`,
      color: 'text-success',
      bg: 'border-success/30 bg-success/5',
    });
  }

  if (data.avgTicket > 0) {
    insights.push({
      icon: Activity,
      title: data.avgTicket >= 50 ? 'Excelente Ticket Médio' : 'Ticket Médio Abaixo',
      desc:
        data.avgTicket >= 50
          ? `Ticket médio de ${formatCurrency(data.avgTicket)}. Continue oferecendo serviços de alto valor agregado!`
          : `Ticket médio de ${formatCurrency(data.avgTicket)}. Ofereça combos e serviços complementares para aumentar o ticket.`,
      color: data.avgTicket >= 50 ? 'text-success' : 'text-warning',
      bg: data.avgTicket >= 50 ? 'border-success/30 bg-success/5' : 'border-warning/30 bg-warning/5',
    });
  }

  return insights.slice(0, 4);
}

const DAY_NAMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

export default async function DashboardPage() {
  const admin = createAdminClient();

  const now = new Date();
  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(now);
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const lastOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

  const [
    { count: countToday },
    { count: countCustomers },
    { data: comandasMonth },
    { count: countOpen },
    { data: services },
    { data: staff },
    { data: appointmentsMonth },
    { data: subscriptions },
    { data: subscriptionPayments },
  ] = await Promise.all([
    admin
      .from('appointments')
      .select('id', { count: 'exact', head: true })
      .eq('barbershop_id', BARBERSHOP_ID)
      .gte('start_at', `${todayStr}T00:00:00.000-03:00`)
      .lte('start_at', `${todayStr}T23:59:59.999-03:00`),
    admin
      .from('customers')
      .select('id', { count: 'exact', head: true })
      .eq('barbershop_id', BARBERSHOP_ID)
      .eq('active', true),
    admin
      .from('comandas')
      .select('total, staff_id')
      .eq('barbershop_id', BARBERSHOP_ID)
      .eq('status', 'closed')
      .gte('closed_at', `${firstOfMonth}T00:00:00.000-03:00`)
      .lte('closed_at', `${lastOfMonth}T23:59:59.999-03:00`),
    admin
      .from('comandas')
      .select('id', { count: 'exact', head: true })
      .eq('barbershop_id', BARBERSHOP_ID)
      .eq('status', 'open'),
    admin
      .from('services')
      .select('name, base_price, base_duration_minutes, category')
      .eq('active', true)
      .eq('barbershop_id', BARBERSHOP_ID)
      .order('display_order')
      .limit(8),
    admin
      .from('staff')
      .select('display_name, role, active')
      .eq('active', true)
      .eq('barbershop_id', BARBERSHOP_ID),
    admin
      .from('appointments')
      .select('start_at, status')
      .eq('barbershop_id', BARBERSHOP_ID)
      .gte('start_at', `${firstOfMonth}T00:00:00.000-03:00`)
      .lte('start_at', `${lastOfMonth}T23:59:59.999-03:00`),
    admin
      .from('subscriptions')
      .select('status, current_price, plan_id')
      .eq('barbershop_id', BARBERSHOP_ID)
      .in('status', ['active', 'past_due']),
    admin
      .from('subscription_payments')
      .select('amount, paid_at, status')
      .eq('barbershop_id', BARBERSHOP_ID)
      .eq('status', 'approved')
      .gte('paid_at', new Date(now.getFullYear(), now.getMonth() - 11, 1).toISOString())
      .order('paid_at', { ascending: true }),
  ]);

  const faturamentoMes = (comandasMonth ?? []).reduce((s, c) => s + Number(c.total ?? 0), 0);
  const totalAtendimentos = comandasMonth?.length ?? 0;
  const avgTicket = totalAtendimentos > 0 ? faturamentoMes / totalAtendimentos : 0;

  // Insights: horário de pico e dia mais movimentado
  const hourCount = new Map<string, number>();
  const dayCount = new Map<number, number>();
  let cancelledCount = 0;

  for (const a of appointmentsMonth ?? []) {
    if (a.status === 'cancelled') { cancelledCount++; continue; }
    const d = new Date(a.start_at as string);
    const hour = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hour12: false }).format(d);
    hourCount.set(hour, (hourCount.get(hour) ?? 0) + 1);
    const dow = d.getDay();
    dayCount.set(dow, (dayCount.get(dow) ?? 0) + 1);
  }

  const totalAppts = (appointmentsMonth ?? []).length;
  const cancelRate = totalAppts > 0 ? (cancelledCount / totalAppts) * 100 : 0;

  const peakEntry = Array.from(hourCount.entries()).sort((a, b) => b[1] - a[1])[0];
  const busiestDayEntry = Array.from(dayCount.entries()).sort((a, b) => b[1] - a[1])[0];

  const insights = getInsights({
    cancelRate,
    peakHour: peakEntry?.[0] ?? '—',
    peakHourCount: peakEntry?.[1] ?? 0,
    busiestDay: DAY_NAMES[busiestDayEntry?.[0] ?? 6] ?? 'Sábado',
    busiestDayCount: busiestDayEntry?.[1] ?? 0,
    avgTicket,
    completedCount: totalAtendimentos,
    cancelledCount,
  });

  // MRR por mês (últimos 12 meses)
  const mrrByMonth = new Map<string, number>();
  for (const p of subscriptionPayments ?? []) {
    if (!p.paid_at) continue;
    const d = new Date(p.paid_at as string);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    mrrByMonth.set(key, (mrrByMonth.get(key) ?? 0) + Number(p.amount ?? 0));
  }
  const mrrData = Array.from(mrrByMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, value]) => ({ month, value }));

  // Assinaturas KPIs
  const activeSubsCount = subscriptions?.length ?? 0;
  const mrr = (subscriptions ?? []).reduce((s, sub) => {
    const price = Number(sub.current_price ?? 0);
    return s + price; // todos mensais por ora
  }, 0);

  const stats = [
    {
      label: 'Atendimentos hoje',
      value: String(countToday ?? 0),
      hint: (countToday ?? 0) === 0 ? 'Nenhum agendamento' : 'Agendados',
      icon: Calendar,
    },
    {
      label: 'Clientes ativos',
      value: String(countCustomers ?? 0),
      hint: 'No cadastro',
      icon: Users,
    },
    {
      label: 'Faturamento mês',
      value: formatCurrency(faturamentoMes),
      hint: `${totalAtendimentos} vendas`,
      icon: CircleDollarSign,
    },
    {
      label: 'Em curso agora',
      value: String(countOpen ?? 0),
      hint: (countOpen ?? 0) === 0 ? 'Nenhuma comanda aberta' : 'Comandas abertas',
      icon: Star,
    },
  ];

  // Por profissional
  const staffMap = new Map(
    (staff ?? []).map((s) => [s.display_name as string, 0])
  );
  for (const c of comandasMonth ?? []) {
    // sem staff_id disponível aqui, skip
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* HEADER */}
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <p className="text-[10px] text-fg-dim tracking-[0.25em] uppercase mb-1">
            Dashboard
          </p>
          <h1
            className="text-3xl text-fg font-bold"
            style={{ fontFamily: 'var(--font-playfair), serif' }}
          >
            Visão Geral
          </h1>
          <p className="text-sm text-fg-muted mt-2">
            Acompanhe o desempenho da barbearia em tempo real.
          </p>
        </div>
        <div className="badge-gold">
          <span className="w-1.5 h-1.5 rounded-full bg-gold animate-pulse" />
          <span>Sistema operacional</span>
        </div>
      </div>

      <div className="divider-gold" />

      {/* STATS CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="card card-hover p-5 relative overflow-hidden group">
              <div className="absolute -top-12 -right-12 w-24 h-24 rounded-full bg-gold/5 group-hover:bg-gold/10 transition-colors blur-xl" />
              <div className="relative flex items-start justify-between mb-3">
                <p className="text-[10px] tracking-[0.15em] uppercase text-fg-muted font-medium">
                  {stat.label}
                </p>
                <div className="p-1.5 rounded-md bg-gold/10 text-gold">
                  <Icon className="w-3.5 h-3.5" />
                </div>
              </div>
              <p className="text-3xl font-bold text-fg leading-none" style={{ fontFamily: 'var(--font-playfair), serif' }}>
                {stat.value}
              </p>
              <p className="text-[11px] text-fg-subtle mt-2">{stat.hint}</p>
            </div>
          );
        })}
      </div>

      {/* ASSINATURAS KPIs */}
      {activeSubsCount > 0 && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Crown className="w-4 h-4 text-gold" />
            <h2 className="text-base font-semibold text-fg" style={{ fontFamily: 'var(--font-playfair), serif' }}>
              Clube de Assinaturas
            </h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Assinantes ativos', value: String(activeSubsCount), cls: 'text-fg' },
              { label: 'MRR estimado', value: formatCurrency(mrr), cls: 'text-gold' },
            ].map((k) => (
              <div key={k.label} className="card p-5">
                <p className="text-[10px] tracking-widest uppercase text-fg-muted mb-2">{k.label}</p>
                <p className={`text-2xl font-bold ${k.cls}`} style={{ fontFamily: 'var(--font-playfair), serif' }}>
                  {k.value}
                </p>
              </div>
            ))}
          </div>
          {mrrData.length > 1 && (
            <DashboardCharts mrrData={mrrData} />
          )}
        </section>
      )}

      {/* GRID PRINCIPAL */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cardápio de serviços */}
        <div className="lg:col-span-2 card p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-xl font-bold text-fg" style={{ fontFamily: 'var(--font-playfair), serif' }}>
                Cardápio de Serviços
              </h2>
              <p className="text-xs text-fg-muted mt-0.5">{services?.length ?? 0} serviços cadastrados</p>
            </div>
            <Link href="/admin/servicos" className="text-xs text-gold hover:underline flex items-center gap-1">
              Ver todos <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(services ?? []).map((svc) => (
              <div key={svc.name} className="flex items-center justify-between p-3 rounded-md bg-bg-elevated border border-border hover:border-gold/30 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-md bg-gold/10 text-gold flex items-center justify-center flex-shrink-0">
                    <Scissors className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-fg truncate">{svc.name}</p>
                    <p className="text-[11px] text-fg-subtle flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5" />
                      {svc.base_duration_minutes} min
                    </p>
                  </div>
                </div>
                <p className="text-base font-bold text-gold" style={{ fontFamily: 'var(--font-playfair), serif' }}>
                  {formatCurrency(Number(svc.base_price))}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Coluna direita */}
        <div className="space-y-6">
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-fg" style={{ fontFamily: 'var(--font-playfair), serif' }}>
                Equipe Ativa
              </h2>
              <span className="badge-gold text-[10px]">{staff?.length ?? 0}</span>
            </div>
            {(staff ?? []).map((member, i) => (
              <div key={i} className="flex items-center gap-3 py-2.5 border-b border-border/30 last:border-0">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-bg"
                  style={{ background: 'linear-gradient(135deg, #D4A04F 0%, #F5C518 100%)' }}
                >
                  {(member.display_name || '?').slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-fg">{member.display_name}</p>
                  <p className="text-[10px] text-fg-subtle uppercase tracking-wider">{member.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* INSIGHTS AUTOMÁTICOS */}
      {insights.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-gold" />
            <h2 className="text-base font-semibold text-gold uppercase tracking-wider text-[12px]">
              Insights Automatizados
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {insights.map((ins, i) => {
              const Icon = ins.icon;
              return (
                <div key={i} className={`card p-5 border ${ins.bg} flex items-start gap-4`}>
                  <div className={`p-2 rounded-md bg-bg-elevated ${ins.color} flex-shrink-0`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <p className={`text-sm font-semibold mb-1 ${ins.color}`}>{ins.title}</p>
                    <p className="text-[12px] text-fg-muted leading-relaxed">{ins.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
