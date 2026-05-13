import {
  Calendar,
  Users,
  CircleDollarSign,
  Scissors,
  TrendingUp,
  Star,
  Clock,
  ArrowUpRight,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { formatCurrency } from '@/lib/utils';

const BARBERSHOP_ID = '11111111-1111-1111-1111-111111111111';

export default async function DashboardPage() {
  const supabase = await createClient();

  // ---- DADOS BÁSICOS ----
  const { data: services } = await supabase
    .from('services')
    .select('name, base_price, base_duration_minutes, category')
    .eq('active', true)
    .order('display_order')
    .limit(8);

  const { data: staff } = await supabase
    .from('staff')
    .select('display_name, role, active')
    .eq('active', true);

  const totalServices = services?.length ?? 0;
  const totalStaff = staff?.length ?? 0;

  // ---- KPIs DO DASHBOARD ----
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
    .toISOString()
    .split('T')[0];

  // Atendimentos de hoje (appointments)
  const { count: countAppointmentsToday } = await supabase
    .from('appointments')
    .select('id', { count: 'exact', head: true })
    .eq('barbershop_id', BARBERSHOP_ID)
    .gte('start_at', `${todayStr}T00:00:00.000-03:00`)
    .lte('start_at', `${todayStr}T23:59:59.999-03:00`);

  // Clientes ativos
  const { count: countCustomers } = await supabase
    .from('customers')
    .select('id', { count: 'exact', head: true })
    .eq('barbershop_id', BARBERSHOP_ID)
    .eq('active', true);

  // Faturamento do mês
  const { data: comandasMonth } = await supabase
    .from('comandas')
    .select('total')
    .eq('barbershop_id', BARBERSHOP_ID)
    .eq('status', 'closed')
    .gte('closed_at', `${firstOfMonth}T00:00:00.000-03:00`);

  const faturamentoMes = (comandasMonth ?? []).reduce(
    (s, c) => s + Number(c.total ?? 0),
    0
  );

  // Comandas abertas (em curso agora)
  const { count: countOpenComandas } = await supabase
    .from('comandas')
    .select('id', { count: 'exact', head: true })
    .eq('barbershop_id', BARBERSHOP_ID)
    .eq('status', 'open');

  const stats = [
    {
      label: 'Atendimentos hoje',
      value: String(countAppointmentsToday ?? 0),
      hint:
        (countAppointmentsToday ?? 0) === 0
          ? 'Nenhum agendamento'
          : 'Agendados',
      icon: Calendar,
    },
    {
      label: 'Clientes ativos',
      value: String(countCustomers ?? 0),
      hint: (countCustomers ?? 0) === 0 ? 'Cadastre clientes' : 'No cadastro',
      icon: Users,
    },
    {
      label: 'Faturamento mês',
      value: formatCurrency(faturamentoMes),
      hint: `${comandasMonth?.length ?? 0} vendas`,
      icon: CircleDollarSign,
    },
    {
      label: 'Em curso agora',
      value: String(countOpenComandas ?? 0),
      hint:
        (countOpenComandas ?? 0) === 0
          ? 'Nenhuma comanda aberta'
          : 'Comandas abertas',
      icon: Star,
    },
  ];

  return (
    <div className="space-y-8 animate-fade-in max-w-7xl">
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
            <div
              key={stat.label}
              className="card card-hover p-5 relative overflow-hidden group"
            >
              <div className="absolute -top-12 -right-12 w-24 h-24 rounded-full bg-gold/5 group-hover:bg-gold/10 transition-colors blur-xl" />

              <div className="relative flex items-start justify-between mb-3">
                <p className="text-[10px] tracking-[0.15em] uppercase text-fg-muted font-medium">
                  {stat.label}
                </p>
                <div className="p-1.5 rounded-md bg-gold/10 text-gold">
                  <Icon className="w-3.5 h-3.5" />
                </div>
              </div>

              <p
                className="text-3xl font-bold text-fg leading-none"
                style={{ fontFamily: 'var(--font-playfair), serif' }}
              >
                {stat.value}
              </p>
              <p className="text-[11px] text-fg-subtle mt-2">{stat.hint}</p>
            </div>
          );
        })}
      </div>

      {/* GRID PRINCIPAL */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cardápio de serviços */}
        <div className="lg:col-span-2 card p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2
                className="text-xl font-bold text-fg"
                style={{ fontFamily: 'var(--font-playfair), serif' }}
              >
                Cardápio de Serviços
              </h2>
              <p className="text-xs text-fg-muted mt-0.5">
                {totalServices} serviços cadastrados
              </p>
            </div>
            <a
              href="/admin/servicos"
              className="text-xs text-gold hover:text-gold-shimmer transition-colors flex items-center gap-1"
            >
              Ver todos
              <ArrowUpRight className="w-3 h-3" />
            </a>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(services ?? []).map((svc) => (
              <div
                key={svc.name}
                className="flex items-center justify-between p-3 rounded-md bg-bg-elevated border border-border hover:border-gold/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-md bg-gold/10 text-gold flex items-center justify-center flex-shrink-0">
                    <Scissors className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-fg truncate">
                      {svc.name}
                    </p>
                    <p className="text-[11px] text-fg-subtle flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5" />
                      {svc.base_duration_minutes} min
                    </p>
                  </div>
                </div>
                <p
                  className="text-base font-bold text-gold"
                  style={{ fontFamily: 'var(--font-playfair), serif' }}
                >
                  {formatCurrency(Number(svc.base_price))}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Coluna direita */}
        <div className="space-y-6">
          {/* Equipe */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <h2
                className="text-lg font-bold text-fg"
                style={{ fontFamily: 'var(--font-playfair), serif' }}
              >
                Equipe Ativa
              </h2>
              <span className="badge-gold text-[10px]">{totalStaff}</span>
            </div>

            {(staff ?? []).map((member, i) => (
              <div
                key={i}
                className="flex items-center gap-3 py-2.5 border-b border-border/30 last:border-0"
              >
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-bg"
                  style={{
                    background:
                      'linear-gradient(135deg, #D4A04F 0%, #F5C518 100%)',
                  }}
                >
                  {(member.display_name || '?').slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-fg">
                    {member.display_name}
                  </p>
                  <p className="text-[10px] text-fg-subtle uppercase tracking-wider">
                    {member.role}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Roadmap atualizado */}
          <div
            className="card p-6 relative overflow-hidden"
            style={{
              background:
                'linear-gradient(135deg, rgba(212, 160, 79, 0.08) 0%, rgba(10, 10, 10, 1) 100%)',
            }}
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-gold/5 rounded-full blur-2xl" />

            <div className="relative">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4 text-gold" />
                <p className="text-[10px] tracking-[0.2em] uppercase text-gold font-semibold">
                  Roadmap
                </p>
              </div>

              <h3
                className="text-lg font-bold text-fg mb-2"
                style={{ fontFamily: 'var(--font-playfair), serif' }}
              >
                Cronograma do projeto
              </h3>

              <div className="space-y-2.5">
                {[
                  { label: 'Setup + Autenticação + Equipe', done: true },
                  { label: 'Agenda + Clientes + Atendimento', done: true },
                  {
                    label: 'Produtos + Financeiro + Metas + Config',
                    done: true,
                  },
                  { label: 'DRE + Contas a Pagar + Assinaturas', done: false },
                  { label: 'IA no WhatsApp + Fidelidade', done: false },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-2.5 text-xs">
                    <div
                      className={`mt-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center flex-shrink-0 ${
                        item.done
                          ? 'bg-gold text-bg'
                          : 'border border-border-strong'
                      }`}
                    >
                      {item.done && (
                        <svg
                          width="8"
                          height="8"
                          viewBox="0 0 12 12"
                          fill="none"
                        >
                          <path
                            d="M2 6L5 9L10 3"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </div>
                    <span
                      className={item.done ? 'text-fg' : 'text-fg-muted'}
                    >
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
