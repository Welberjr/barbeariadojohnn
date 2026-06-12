import {
  Calendar,
  Users,
  CircleDollarSign,
  Scissors,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Zap,
  AlertTriangle,
  TrendingUp,
  Activity,
  Crown,
  Wallet,
  PackageOpen,
  ChevronRight,
  Plus,
  Receipt,
  Gauge,
} from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import Link from 'next/link';
import { cn, formatCurrency } from '@/lib/utils';
import { InfoTip } from '@/components/info-tip';

const BARBERSHOP_ID = '11111111-1111-1111-1111-111111111111';

export const dynamic = 'force-dynamic';

const DAY_NAMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

function getInsights(data: {
  cancelRate: number;
  peakHour: string;
  peakHourCount: number;
  busiestDay: string;
  busiestDayCount: number;
  avgTicket: number;
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
      desc: `${data.cancelRate.toFixed(1)}% dos atendimentos foram cancelados este mês. Considere confirmações automáticas via WhatsApp.`,
      color: 'text-warning',
      bg: 'border-warning/30 bg-warning/5',
    });
  }

  if (data.peakHourCount > 0) {
    insights.push({
      icon: Clock,
      title: 'Horário de Pico',
      desc: `${data.peakHour}h é o horário mais movimentado (${data.peakHourCount} atendimentos). Reforce a equipe neste período.`,
      color: 'text-info',
      bg: 'border-info/30 bg-info/5',
    });
  }

  if (data.busiestDayCount > 0) {
    insights.push({
      icon: TrendingUp,
      title: 'Dia Mais Movimentado',
      desc: `${data.busiestDay} é o dia com mais atendimentos (${data.busiestDayCount}). Garanta a equipe completa.`,
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
          ? `Ticket médio de ${formatCurrency(data.avgTicket)}. Continue oferecendo serviços de alto valor!`
          : `Ticket médio de ${formatCurrency(data.avgTicket)}. Ofereça combos para aumentar o ticket.`,
      color: data.avgTicket >= 50 ? 'text-success' : 'text-warning',
      bg: data.avgTicket >= 50 ? 'border-success/30 bg-success/5' : 'border-warning/30 bg-warning/5',
    });
  }

  return insights.slice(0, 4);
}

export default async function DashboardPage() {
  const admin = createAdminClient();

  const now = new Date();
  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(now);
  const year = Number(todayStr.slice(0, 4));
  const month = Number(todayStr.slice(5, 7));
  const dayOfMonth = Number(todayStr.slice(8, 10));
  const daysInMonth = new Date(year, month, 0).getDate();
  const elapsedRatio = Math.min(1, dayOfMonth / daysInMonth);

  const firstOfMonth = `${todayStr.slice(0, 8)}01`;
  const cutoff14 = new Date(now.getTime() - 13 * 86400000);
  const cutoff14Str = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(cutoff14);
  const rangeStart = cutoff14Str < firstOfMonth ? cutoff14Str : firstOfMonth;

  const prevMonthDate = new Date(year, month - 2, 1);
  const prevFirst = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}-01`;
  const prevDaysInMonth = new Date(prevMonthDate.getFullYear(), prevMonthDate.getMonth() + 1, 0).getDate();
  const prevSameDay = `${prevFirst.slice(0, 8)}${String(Math.min(dayOfMonth, prevDaysInMonth)).padStart(2, '0')}`;

  const [
    { data: comandasRange },
    { data: openComandas },
    { data: prevMonthComandas },
    { data: todayAppointments },
    { data: pendingBills },
    { data: productsRaw },
    { data: subsRaw },
    { data: goalRaw },
    { data: staffRaw },
    { data: apptsMonth },
  ] = await Promise.all([
    admin
      .from('comandas')
      .select('id, total, staff_id, closed_at')
      .eq('barbershop_id', BARBERSHOP_ID)
      .eq('status', 'closed')
      .gte('closed_at', `${rangeStart}T00:00:00.000-03:00`),
    admin
      .from('comandas')
      .select('id, total')
      .eq('barbershop_id', BARBERSHOP_ID)
      .eq('status', 'open'),
    admin
      .from('comandas')
      .select('total')
      .eq('barbershop_id', BARBERSHOP_ID)
      .eq('status', 'closed')
      .gte('closed_at', `${prevFirst}T00:00:00.000-03:00`)
      .lte('closed_at', `${prevSameDay}T23:59:59.999-03:00`),
    admin
      .from('appointments')
      .select('id, start_at, status, customers:customers(full_name), staff:staff(display_name), appointment_services(service:services(name))')
      .eq('barbershop_id', BARBERSHOP_ID)
      .gte('start_at', `${todayStr}T00:00:00.000-03:00`)
      .lte('start_at', `${todayStr}T23:59:59.999-03:00`)
      .order('start_at', { ascending: true }),
    admin
      .from('bills')
      .select('id, description, amount, due_date, status')
      .eq('barbershop_id', BARBERSHOP_ID)
      .in('status', ['pending', 'overdue'])
      .lte('due_date', todayStr),
    admin
      .from('products')
      .select('id, name, stock_current, stock_minimum, active')
      .eq('barbershop_id', BARBERSHOP_ID)
      .eq('active', true),
    admin
      .from('subscriptions')
      .select('status, current_price')
      .eq('barbershop_id', BARBERSHOP_ID)
      .in('status', ['active', 'past_due']),
    admin
      .from('goals')
      .select('revenue_target, appointments_target')
      .eq('barbershop_id', BARBERSHOP_ID)
      .in('period_type', ['monthly', 'month'])
      .eq('year', year)
      .eq('month', month)
      .is('staff_id', null)
      .maybeSingle(),
    admin
      .from('staff')
      .select('id, display_name')
      .eq('active', true)
      .eq('barbershop_id', BARBERSHOP_ID),
    admin
      .from('appointments')
      .select('start_at, status')
      .eq('barbershop_id', BARBERSHOP_ID)
      .gte('start_at', `${firstOfMonth}T00:00:00.000-03:00`),
  ]);
  // ---------- Processamento ----------
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const range = (comandasRange ?? []) as any[];

  const spDay = (iso: string) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(iso));

  const comandasMonth = range.filter((c) => spDay(c.closed_at) >= firstOfMonth);
  const comandasToday = range.filter((c) => spDay(c.closed_at) === todayStr);

  const fatHoje = comandasToday.reduce((s, c) => s + Number(c.total ?? 0), 0);
  const fatMes = comandasMonth.reduce((s, c) => s + Number(c.total ?? 0), 0);
  const vendasHoje = comandasToday.length;
  const vendasMes = comandasMonth.length;
  const ticketHoje = vendasHoje > 0 ? fatHoje / vendasHoje : 0;
  const ticketMes = vendasMes > 0 ? fatMes / vendasMes : 0;

  const fatMesAnterior = (prevMonthComandas ?? []).reduce((s, c) => s + Number(c.total ?? 0), 0);
  const deltaMes = fatMesAnterior > 0 ? ((fatMes - fatMesAnterior) / fatMesAnterior) * 100 : null;

  const emCursoCount = (openComandas ?? []).length;
  const emCursoValor = (openComandas ?? []).reduce((s, c) => s + Number(c.total ?? 0), 0);

  // Agenda de hoje
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const appts = (todayAppointments ?? []) as any[];
  const apptsValidos = appts.filter((a) => a.status !== 'cancelled');
  const apptsConcluidos = appts.filter((a) => a.status === 'completed').length;
  const nowMs = now.getTime();
  const proximosAppts = apptsValidos
    .filter((a) => a.status !== 'completed' && new Date(a.start_at).getTime() >= nowMs - 30 * 60000)
    .slice(0, 6);

  // Alertas
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const billsDue = (pendingBills ?? []) as any[];
  const billsVencidas = billsDue.filter((b) => b.due_date < todayStr);
  const billsHoje = billsDue.filter((b) => b.due_date === todayStr);
  const valorVencidas = billsVencidas.reduce((s, b) => s + Number(b.amount ?? 0), 0);
  const valorHoje = billsHoje.reduce((s, b) => s + Number(b.amount ?? 0), 0);

  const lowStock = ((productsRaw ?? []) as { id: string; name: string; stock_current: number; stock_minimum: number }[])
    .filter((p) => Number(p.stock_current) <= Number(p.stock_minimum));

  const subsAtivas = (subsRaw ?? []).filter((s) => s.status === 'active');
  const subsInadimplentes = (subsRaw ?? []).filter((s) => s.status === 'past_due');
  const mrr = subsAtivas.reduce((s, sub) => s + Number(sub.current_price ?? 0), 0);

  const temAlertas = billsVencidas.length > 0 || billsHoje.length > 0 || subsInadimplentes.length > 0 || lowStock.length > 0;

  // Meta do mes
  const revenueTarget = Number(goalRaw?.revenue_target ?? 0);
  const metaPct = revenueTarget > 0 ? Math.min(100, (fatMes / revenueTarget) * 100) : 0;
  const projecao = elapsedRatio > 0.02 ? fatMes / elapsedRatio : fatMes;
  const projecaoPct = revenueTarget > 0 ? Math.min(100, (projecao / revenueTarget) * 100) : 0;

  // Ranking da equipe (mes)
  const staffNames = new Map(((staffRaw ?? []) as { id: string; display_name: string }[]).map((s) => [s.id, s.display_name]));
  const revenueByStaff = new Map<string, number>();
  const countByStaff = new Map<string, number>();
  for (const c of comandasMonth) {
    if (!c.staff_id) continue;
    revenueByStaff.set(c.staff_id, (revenueByStaff.get(c.staff_id) ?? 0) + Number(c.total ?? 0));
    countByStaff.set(c.staff_id, (countByStaff.get(c.staff_id) ?? 0) + 1);
  }
  const ranking = Array.from(revenueByStaff.entries())
    .map(([sid, total]) => ({
      name: staffNames.get(sid) ?? '—',
      total,
      count: countByStaff.get(sid) ?? 0,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);
  const topRevenue = ranking[0]?.total ?? 0;

  // Top servicos do mes
  const monthIds = comandasMonth.map((c) => c.id);
  let topServicos: { name: string; count: number; total: number }[] = [];
  if (monthIds.length > 0) {
    const { data: itemsMonth } = await admin
      .from('comanda_items')
      .select('item_type, total_price, service:services(name)')
      .in('comanda_id', monthIds)
      .eq('item_type', 'service');
    const byService = new Map<string, { count: number; total: number }>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const it of (itemsMonth ?? []) as any[]) {
      const name = (Array.isArray(it.service) ? it.service[0]?.name : it.service?.name) ?? 'Outros';
      const cur = byService.get(name) ?? { count: 0, total: 0 };
      cur.count += 1;
      cur.total += Number(it.total_price ?? 0);
      byService.set(name, cur);
    }
    topServicos = Array.from(byService.entries())
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }
  const topServicoTotal = topServicos[0]?.total ?? 0;

  // Grafico: faturamento por dia (ultimos 14 dias)
  const dias: { label: string; key: string; valor: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86400000);
    const key = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(d);
    dias.push({ key, label: key.slice(8, 10) + '/' + key.slice(5, 7), valor: 0 });
  }
  const diasMap = new Map(dias.map((d) => [d.key, d]));
  for (const c of range) {
    const k = spDay(c.closed_at);
    const slot = diasMap.get(k);
    if (slot) slot.valor += Number(c.total ?? 0);
  }
  const maxDia = Math.max(1, ...dias.map((d) => d.valor));

  // Insights (mes)
  const hourCount = new Map<string, number>();
  const dayCount = new Map<number, number>();
  let cancelledCount = 0;
  for (const a of apptsMonth ?? []) {
    if (a.status === 'cancelled') { cancelledCount++; continue; }
    const d = new Date(a.start_at as string);
    const hour = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hour12: false }).format(d);
    hourCount.set(hour, (hourCount.get(hour) ?? 0) + 1);
    dayCount.set(d.getDay(), (dayCount.get(d.getDay()) ?? 0) + 1);
  }
  const totalApptsMes = (apptsMonth ?? []).length;
  const cancelRate = totalApptsMes > 0 ? (cancelledCount / totalApptsMes) * 100 : 0;
  const peakEntry = Array.from(hourCount.entries()).sort((a, b) => b[1] - a[1])[0];
  const busiestDayEntry = Array.from(dayCount.entries()).sort((a, b) => b[1] - a[1])[0];
  const insights = getInsights({
    cancelRate,
    peakHour: peakEntry?.[0] ?? '—',
    peakHourCount: peakEntry?.[1] ?? 0,
    busiestDay: DAY_NAMES[busiestDayEntry?.[0] ?? 6] ?? 'Sábado',
    busiestDayCount: busiestDayEntry?.[1] ?? 0,
    avgTicket: ticketMes,
  });

  const hojeLabel = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(now);

  const fmtHora = (iso: string) =>
    new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
  return (
    <div className="space-y-6 animate-fade-in">
      {/* HEADER + ACOES RAPIDAS */}
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <p className="text-[10px] text-fg-dim tracking-[0.25em] uppercase mb-1 capitalize">
            {hojeLabel}
          </p>
          <h1 className="text-3xl text-fg font-bold" style={{ fontFamily: 'var(--font-playfair), serif' }}>
            Visão Geral
          </h1>
          <p className="text-sm text-fg-muted mt-2">
            O essencial do seu negócio, em um só lugar.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link href="/admin/agenda" className="btn-gold-shimmer text-xs flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            <span>Agendamento</span>
          </Link>
          <Link href="/admin/comandas" className="btn-gold-outline text-xs flex items-center gap-1.5">
            <Receipt className="w-3.5 h-3.5" />
            <span>Comandas</span>
          </Link>
          <Link href="/admin/clientes" className="btn-ghost text-xs flex items-center gap-1.5 border border-border">
            <Users className="w-3.5 h-3.5" />
            <span>Clientes</span>
          </Link>
        </div>
      </div>

      <div className="divider-gold" />

      {/* HOJE */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link href="/admin/comandas" className="card p-5 group hover:border-gold/40 transition-colors">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] text-fg-dim tracking-widest uppercase flex items-center gap-1">Faturado hoje <InfoTip text="Soma das comandas fechadas hoje. Não inclui comandas ainda abertas nem agendamentos futuros." /></p>
            <CircleDollarSign className="w-4 h-4 text-gold" />
          </div>
          <p className="text-2xl font-bold text-fg" style={{ fontFamily: 'var(--font-playfair), serif' }}>
            {formatCurrency(fatHoje)}
          </p>
          <p className="text-[11px] text-fg-subtle mt-1">
            {vendasHoje} {vendasHoje === 1 ? 'venda' : 'vendas'} · ticket {formatCurrency(ticketHoje)}
          </p>
        </Link>

        <Link href="/admin/agenda" className="card p-5 group hover:border-gold/40 transition-colors">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] text-fg-dim tracking-widest uppercase flex items-center gap-1">Agenda de hoje <InfoTip text="Atendimentos concluídos sobre o total agendado para hoje (cancelados ficam de fora)." /></p>
            <Calendar className="w-4 h-4 text-gold" />
          </div>
          <p className="text-2xl font-bold text-fg" style={{ fontFamily: 'var(--font-playfair), serif' }}>
            {apptsConcluidos}<span className="text-fg-subtle text-lg"> / {apptsValidos.length}</span>
          </p>
          <p className="text-[11px] text-fg-subtle mt-1">
            {apptsValidos.length - apptsConcluidos > 0
              ? `${apptsValidos.length - apptsConcluidos} ainda por atender`
              : apptsValidos.length === 0
                ? 'Nenhum agendamento hoje'
                : 'Todos atendidos!'}
          </p>
        </Link>

        <Link href="/admin/comandas" className="card p-5 group hover:border-gold/40 transition-colors">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] text-fg-dim tracking-widest uppercase flex items-center gap-1">Em curso agora <InfoTip text="Comandas abertas neste momento e quanto elas somam. É dinheiro que está na casa, mas ainda não foi cobrado." /></p>
            <Scissors className="w-4 h-4 text-gold" />
          </div>
          <p className="text-2xl font-bold text-fg" style={{ fontFamily: 'var(--font-playfair), serif' }}>
            {emCursoCount}
          </p>
          <p className="text-[11px] text-fg-subtle mt-1">
            {emCursoCount > 0 ? `${formatCurrency(emCursoValor)} na casa` : 'Nenhuma comanda aberta'}
          </p>
        </Link>

        <Link href="/admin/financeiro" className="card p-5 group hover:border-gold/40 transition-colors">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] text-fg-dim tracking-widest uppercase flex items-center gap-1">Mês até agora <InfoTip text="Faturamento acumulado do mês. A comparação usa o mesmo número de dias do mês passado, para ser justa." /></p>
            <Wallet className="w-4 h-4 text-gold" />
          </div>
          <p className="text-2xl font-bold text-gold" style={{ fontFamily: 'var(--font-playfair), serif' }}>
            {formatCurrency(fatMes)}
          </p>
          <p className="text-[11px] mt-1 flex items-center gap-1">
            {deltaMes !== null ? (
              <>
                {deltaMes >= 0 ? (
                  <ArrowUpRight className="w-3 h-3 text-success" />
                ) : (
                  <ArrowDownRight className="w-3 h-3 text-danger" />
                )}
                <span className={deltaMes >= 0 ? 'text-success' : 'text-danger'}>
                  {Math.abs(deltaMes).toFixed(0)}%
                </span>
                <span className="text-fg-subtle">vs mesmo período do mês passado</span>
              </>
            ) : (
              <span className="text-fg-subtle">{vendasMes} vendas no mês</span>
            )}
          </p>
        </Link>
      </div>

      {/* ALERTAS ACIONAVEIS */}
      {temAlertas && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {(billsVencidas.length > 0 || billsHoje.length > 0) && (
            <Link
              href="/admin/contas-pagar"
              className="card p-4 border-danger/40 bg-danger/5 hover:bg-danger/10 transition-colors flex items-center gap-3"
            >
              <div className="w-9 h-9 rounded-md bg-danger/15 text-danger flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-fg">
                  {billsVencidas.length > 0
                    ? `${billsVencidas.length} conta${billsVencidas.length > 1 ? 's' : ''} vencida${billsVencidas.length > 1 ? 's' : ''} (${formatCurrency(valorVencidas)})`
                    : `${billsHoje.length} conta${billsHoje.length > 1 ? 's vencem' : ' vence'} hoje (${formatCurrency(valorHoje)})`}
                </p>
                <p className="text-[11px] text-fg-subtle">Toque para resolver agora</p>
              </div>
              <ChevronRight className="w-4 h-4 text-fg-subtle" />
            </Link>
          )}
          {subsInadimplentes.length > 0 && (
            <Link
              href="/admin/assinaturas"
              className="card p-4 border-warning/40 bg-warning/5 hover:bg-warning/10 transition-colors flex items-center gap-3"
            >
              <div className="w-9 h-9 rounded-md bg-warning/15 text-warning flex items-center justify-center flex-shrink-0">
                <Crown className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-fg">
                  {subsInadimplentes.length} assinatura{subsInadimplentes.length > 1 ? 's' : ''} inadimplente{subsInadimplentes.length > 1 ? 's' : ''}
                </p>
                <p className="text-[11px] text-fg-subtle">Cobre o cliente e regularize o ciclo</p>
              </div>
              <ChevronRight className="w-4 h-4 text-fg-subtle" />
            </Link>
          )}
          {lowStock.length > 0 && (
            <Link
              href="/admin/produtos"
              className="card p-4 border-info/40 bg-info/5 hover:bg-info/10 transition-colors flex items-center gap-3"
            >
              <div className="w-9 h-9 rounded-md bg-info/15 text-info flex items-center justify-center flex-shrink-0">
                <PackageOpen className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-fg">
                  {lowStock.length} produto{lowStock.length > 1 ? 's' : ''} com estoque baixo
                </p>
                <p className="text-[11px] text-fg-subtle truncate">
                  {lowStock.slice(0, 2).map((p) => p.name).join(', ')}{lowStock.length > 2 ? '…' : ''}
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-fg-subtle" />
            </Link>
          )}
        </div>
      )}
      {/* AGENDA DE HOJE + META DO MES */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-fg flex items-center gap-2" style={{ fontFamily: 'var(--font-playfair), serif' }}>
              <Clock className="w-4 h-4 text-gold" />
              Próximos atendimentos <InfoTip text="Quem ainda vai ser atendido hoje, em ordem de horário. Toque em um item para abrir a agenda." />
            </h2>
            <Link href="/admin/agenda" className="text-[11px] text-gold hover:underline flex items-center gap-0.5">
              Ver agenda <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
          {proximosAppts.length === 0 ? (
            <p className="text-sm text-fg-subtle py-6 text-center">
              Nenhum atendimento pendente para hoje.
            </p>
          ) : (
            <div className="space-y-1.5">
              {proximosAppts.map((a) => {
                const servNames = (a.appointment_services ?? [])
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  .map((as2: any) => (Array.isArray(as2.service) ? as2.service[0]?.name : as2.service?.name))
                  .filter(Boolean)
                  .join(' + ');
                const custName = Array.isArray(a.customers) ? a.customers[0]?.full_name : a.customers?.full_name;
                const staffName = Array.isArray(a.staff) ? a.staff[0]?.display_name : a.staff?.display_name;
                return (
                  <Link
                    key={a.id}
                    href="/admin/agenda"
                    className="flex items-center gap-3 p-2.5 rounded-md bg-bg-elevated border border-border/50 hover:border-gold/40 transition-colors"
                  >
                    <span className="text-sm font-bold text-gold w-12 flex-shrink-0">{fmtHora(a.start_at)}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-fg font-medium truncate">{custName ?? 'Cliente'}</p>
                      <p className="text-[11px] text-fg-subtle truncate">
                        {servNames || 'Serviço'} · {staffName ?? '—'}
                      </p>
                    </div>
                    <span
                      className={cn(
                        'text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full border flex-shrink-0',
                        a.status === 'confirmed'
                          ? 'text-success border-success/40 bg-success/10'
                          : 'text-fg-muted border-border bg-bg'
                      )}
                    >
                      {a.status === 'confirmed' ? 'Confirmado' : 'Agendado'}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        <section className="card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-fg flex items-center gap-2" style={{ fontFamily: 'var(--font-playfair), serif' }}>
              <Gauge className="w-4 h-4 text-gold" />
              Meta do mês <InfoTip text="Progresso da meta consolidada: barra cheia é o realizado, barra clara é a projeção e o traço marca o esperado para hoje." />
            </h2>
            <Link href="/admin/metas" className="text-[11px] text-gold hover:underline flex items-center gap-0.5">
              Ver metas <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>

          {revenueTarget > 0 ? (
            <div className="space-y-3">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-2xl font-bold text-gold" style={{ fontFamily: 'var(--font-playfair), serif' }}>
                    {formatCurrency(fatMes)}
                  </p>
                  <p className="text-[11px] text-fg-subtle">de {formatCurrency(revenueTarget)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-fg">{metaPct.toFixed(0)}%</p>
                  <p className="text-[11px] text-fg-subtle">projeção {formatCurrency(projecao)} ({projecaoPct.toFixed(0)}%)</p>
                </div>
              </div>
              <div className="relative h-3 bg-bg-elevated border border-border/60 rounded-full overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 rounded-full opacity-25"
                  style={{ width: `${projecaoPct}%`, background: 'linear-gradient(90deg, #B8862A, #F5C518)' }}
                />
                <div
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{ width: `${metaPct}%`, background: 'linear-gradient(90deg, #B8862A, #F5C518)' }}
                />
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-fg/50"
                  style={{ left: `${Math.min(99.5, elapsedRatio * 100)}%` }}
                />
              </div>
              <p className="text-[11px] text-fg-subtle">
                Dia {dayOfMonth} de {daysInMonth} · {vendasMes} vendas · ticket médio {formatCurrency(ticketMes)}
              </p>
            </div>
          ) : (
            <div className="py-4 text-center space-y-2">
              <p className="text-sm text-fg-subtle">Nenhuma meta definida para este mês.</p>
              <Link href="/admin/metas" className="btn-gold-outline text-xs inline-flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5" />
                Definir meta
              </Link>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/50">
            <div>
              <p className="text-[9px] uppercase tracking-wider text-fg-dim">Assinantes</p>
              <p className="text-base font-bold text-fg">{subsAtivas.length}</p>
            </div>
            <div>
              <p className="text-[9px] uppercase tracking-wider text-fg-dim flex items-center gap-1">MRR <InfoTip text="Receita recorrente mensal: a soma das mensalidades dos assinantes ativos do clube." /></p>
              <p className="text-base font-bold text-gold">{formatCurrency(mrr)}</p>
            </div>
            <div>
              <p className="text-[9px] uppercase tracking-wider text-fg-dim">Inadimplentes</p>
              <p className={cn('text-base font-bold', subsInadimplentes.length > 0 ? 'text-warning' : 'text-fg')}>
                {subsInadimplentes.length}
              </p>
            </div>
          </div>
        </section>
      </div>
      {/* GRAFICO 14 DIAS + RANKING */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="card p-5 space-y-3">
          <h2 className="text-base font-semibold text-fg flex items-center gap-2" style={{ fontFamily: 'var(--font-playfair), serif' }}>
            <TrendingUp className="w-4 h-4 text-gold" />
            Faturamento · últimos 14 dias <InfoTip text="Vendas fechadas por dia nas últimas duas semanas. A barra mais clara é hoje. Passe o mouse para ver o valor exato." />
          </h2>
          <svg viewBox="0 0 560 170" className="w-full" role="img" aria-label="Faturamento dos últimos 14 dias">
            {dias.map((d, i) => {
              const barH = Math.max(2, (d.valor / maxDia) * 120);
              const x = 8 + i * 39.5;
              const isHoje = d.key === todayStr;
              return (
                <g key={d.key}>
                  <title>{`${d.label}: ${formatCurrency(d.valor)}`}</title>
                  <rect x={x} y={140 - barH} width={26} height={barH} rx={4}
                    fill={isHoje ? '#F5C518' : '#B8862A'} opacity={isHoje ? 1 : 0.75} />
                  <text x={x + 13} y={156} textAnchor="middle" fontSize={9} fill="#9C9C9C">
                    {d.label.slice(0, 2)}
                  </text>
                </g>
              );
            })}
          </svg>
        </section>

        <section className="card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-fg flex items-center gap-2" style={{ fontFamily: 'var(--font-playfair), serif' }}>
              <Crown className="w-4 h-4 text-gold" />
              Equipe do mês <InfoTip text="Ranking de faturamento dos profissionais no mês, com o número de atendimentos de cada um." />
            </h2>
            <Link href="/admin/metas" className="text-[11px] text-gold hover:underline flex items-center gap-0.5">
              Desempenho <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
          {ranking.length === 0 ? (
            <p className="text-sm text-fg-subtle py-6 text-center">Sem vendas registradas neste mês.</p>
          ) : (
            <div className="space-y-2.5">
              {ranking.map((r, idx) => (
                <div key={r.name} className="space-y-1">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <p className="text-fg font-medium flex items-center gap-2 min-w-0">
                      <span className={cn(
                        'w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center flex-shrink-0',
                        idx === 0 ? 'bg-gold text-bg' : 'bg-bg-elevated border border-border text-fg-muted'
                      )}>
                        {idx + 1}
                      </span>
                      <span className="truncate">{r.name}</span>
                    </p>
                    <p className="text-fg-muted text-xs flex-shrink-0">
                      <strong className="text-fg">{formatCurrency(r.total)}</strong> · {r.count}
                    </p>
                  </div>
                  <div className="h-1.5 bg-bg-elevated rounded-full overflow-hidden">
                    <div className="h-full rounded-full"
                      style={{ width: `${(r.total / topRevenue) * 100}%`, background: 'linear-gradient(90deg, #B8862A, #F5C518)' }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* TOP SERVICOS + INSIGHTS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-fg flex items-center gap-2" style={{ fontFamily: 'var(--font-playfair), serif' }}>
              <Scissors className="w-4 h-4 text-gold" />
              Serviços mais vendidos <InfoTip text="Os serviços que mais geraram receita no mês, com a quantidade de vezes que foram vendidos." />
            </h2>
            <Link href="/admin/servicos" className="text-[11px] text-gold hover:underline flex items-center gap-0.5">
              Cardápio <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
          {topServicos.length === 0 ? (
            <p className="text-sm text-fg-subtle py-6 text-center">Sem serviços vendidos neste mês.</p>
          ) : (
            <div className="space-y-2.5">
              {topServicos.map((s) => (
                <div key={s.name} className="space-y-1">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <p className="text-fg truncate">{s.name}</p>
                    <p className="text-fg-muted text-xs flex-shrink-0">
                      <strong className="text-fg">{formatCurrency(s.total)}</strong> · {s.count}x
                    </p>
                  </div>
                  <div className="h-1.5 bg-bg-elevated rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-gold/70" style={{ width: `${(s.total / topServicoTotal) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-fg flex items-center gap-2 px-1" style={{ fontFamily: 'var(--font-playfair), serif' }}>
            <Zap className="w-4 h-4 text-gold" />
            Insights automatizados <InfoTip text="Leituras automáticas dos seus dados: picos de movimento, cancelamentos e ticket médio, com sugestões práticas." />
          </h2>
          <div className="space-y-3">
            {insights.map((ins) => {
              const Icon = ins.icon;
              return (
                <div key={ins.title} className={cn('card p-4 border flex items-start gap-3', ins.bg)}>
                  <Icon className={cn('w-4 h-4 mt-0.5 flex-shrink-0', ins.color)} />
                  <div>
                    <p className={cn('text-sm font-semibold', ins.color)}>{ins.title}</p>
                    <p className="text-xs text-fg-muted mt-0.5 leading-relaxed">{ins.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}