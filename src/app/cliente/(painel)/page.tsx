import Link from 'next/link';
import {
  CalendarPlus,
  Calendar,
  Star,
  Crown,
  Trophy,
  Bell,
  ChevronRight,
  Scissors,
  Clock,
} from 'lucide-react';
import { requireCustomer } from '@/lib/customer-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  getActiveSubscription,
  formatAllowedDays,
} from '@/lib/subscriptions';
import { formatCurrency } from '@/lib/utils';

export const metadata = { title: 'Início' };
export const dynamic = 'force-dynamic';

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR');
}

function fmtDateTime(iso: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

const TIER_LABELS: Record<string, string> = {
  bronze: 'Bronze',
  silver: 'Prata',
  gold: 'Ouro',
  diamond: 'Diamante',
};

export default async function ClienteHomePage() {
  const { customer } = await requireCustomer();
  const admin = createAdminClient();

  const [{ data: loyalty }, sub, { data: nextAppts }, { data: lastNotifs }] =
    await Promise.all([
      admin
        .from('loyalty_points')
        .select('balance, lifetime_earned')
        .eq('customer_id', customer.id)
        .maybeSingle(),
      getActiveSubscription(admin, customer.id),
      admin
        .from('appointments')
        .select(
          `id, start_at, end_at, status, subscription_id,
           staff:staff (display_name),
           appointment_services ( services:services (name) )`
        )
        .eq('customer_id', customer.id)
        .eq('status', 'scheduled')
        .gte('start_at', new Date().toISOString())
        .order('start_at', { ascending: true })
        .limit(3),
      admin
        .from('notifications')
        .select('id, title, body, created_at, read_at')
        .eq('customer_id', customer.id)
        .order('created_at', { ascending: false })
        .limit(3),
    ]);

  const balance = Number(loyalty?.balance ?? customer.loyalty_points ?? 0);
  const lifetime = Number(loyalty?.lifetime_earned ?? 0);
  const firstName = (customer.full_name ?? 'Cliente').trim().split(/\s+/)[0] || 'Cliente';
  const tierLabel = TIER_LABELS[customer.loyalty_tier ?? ''] ?? null;

  const usagePct = sub
    ? Math.min(100, (sub.usedInCycle / Math.max(1, sub.plan.included_uses)) * 100)
    : 0;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* SAUDAÇÃO */}
      <div className="flex items-center gap-4">
        {customer.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={customer.photo_url}
            alt={customer.full_name}
            className="w-16 h-16 rounded-full object-cover border-2 border-gold/40"
          />
        ) : (
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold text-bg flex-shrink-0"
            style={{
              background: 'linear-gradient(135deg, #D4A04F 0%, #F5C518 100%)',
            }}
          >
            {customer.full_name
              .split(' ')
              .map((n) => n[0])
              .join('')
              .slice(0, 2)
              .toUpperCase()}
          </div>
        )}
        <div>
          <p className="text-[10px] text-gold tracking-[0.3em] uppercase font-semibold">
            Bem-vindo de volta
          </p>
          <h1
            className="text-2xl font-bold text-fg leading-tight"
            style={{ fontFamily: 'var(--font-playfair), serif' }}
          >
            {firstName}
          </h1>
          {tierLabel && (
            <p className="text-[11px] text-fg-muted flex items-center gap-1 mt-0.5">
              <Star className="w-3 h-3 text-gold fill-current" />
              Nível {tierLabel}
            </p>
          )}
        </div>
      </div>

      {/* PONTOS */}
      <div className="grid grid-cols-2 gap-3">
        <Link href="/cliente/ranking" className="card card-hover p-4 block">
          <p className="text-[9px] uppercase tracking-wider text-fg-dim mb-1">
            Saldo de pontos
          </p>
          <p
            className="text-3xl font-bold text-gold leading-none"
            style={{ fontFamily: 'var(--font-playfair), serif' }}
          >
            {balance.toLocaleString('pt-BR')}
          </p>
          <p className="text-[10px] text-fg-subtle mt-1.5">
            R$ 1 gasto = 10 pontos
          </p>
        </Link>
        <Link href="/cliente/ranking" className="card card-hover p-4 block">
          <p className="text-[9px] uppercase tracking-wider text-fg-dim mb-1">
            Pontos acumulados
          </p>
          <p
            className="text-3xl font-bold text-fg leading-none"
            style={{ fontFamily: 'var(--font-playfair), serif' }}
          >
            {lifetime.toLocaleString('pt-BR')}
          </p>
          <p className="text-[10px] text-fg-subtle mt-1.5 flex items-center gap-1">
            <Trophy className="w-3 h-3 text-gold" />
            Ver ranking
          </p>
        </Link>
      </div>

      {/* ASSINATURA */}
      {sub ? (
        <div
          className="card-premium p-5 space-y-3"
          style={{
            background:
              'linear-gradient(135deg, rgba(212, 160, 79, 0.10) 0%, rgba(10, 10, 10, 1) 100%)',
          }}
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[10px] text-gold tracking-[0.25em] uppercase font-semibold flex items-center gap-1.5">
                <Crown className="w-3.5 h-3.5" />
                Minha assinatura
              </p>
              <h2
                className="text-lg font-bold text-fg mt-0.5"
                style={{ fontFamily: 'var(--font-playfair), serif' }}
              >
                {sub.plan.name}
              </h2>
            </div>
            {sub.isExpired ? (
              <span className="px-2 py-0.5 rounded-full text-[9px] uppercase tracking-wider font-semibold bg-danger/10 text-danger border border-danger/30">
                Vencida
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full text-[9px] uppercase tracking-wider font-semibold bg-success/10 text-success border border-success/30">
                Ativa
              </span>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between text-[11px] mb-1.5">
              <span className="text-fg-muted flex items-center gap-1.5">
                <Scissors className="w-3 h-3 text-gold" />
                Usos neste ciclo
              </span>
              <span className="text-fg font-semibold">
                {sub.usedInCycle} de {sub.plan.included_uses}
              </span>
            </div>
            <div className="h-2.5 rounded-full bg-bg-elevated border border-border overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${usagePct}%`,
                  background: 'linear-gradient(90deg, #D4A04F 0%, #F5C518 100%)',
                }}
              />
            </div>
            {sub.usesLeft > 0 && !sub.isExpired && (
              <p className="text-[10px] text-fg-subtle mt-1.5">
                Você ainda tem {sub.usesLeft}{' '}
                {sub.usesLeft === 1 ? 'atendimento' : 'atendimentos'} para usar
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <div>
              <p className="text-[9px] uppercase tracking-wider text-fg-dim">
                {sub.isExpired ? 'Venceu em' : 'Vence em'}
              </p>
              <p
                className={`text-sm font-semibold ${sub.isExpired ? 'text-danger' : 'text-fg'}`}
              >
                {fmtDate(sub.current_period_end)}
              </p>
            </div>
            <div>
              <p className="text-[9px] uppercase tracking-wider text-fg-dim">
                Dias do plano
              </p>
              <p className="text-sm font-semibold text-gold">
                {formatAllowedDays(sub.plan.allowed_days)}
              </p>
            </div>
          </div>

          <p className="text-[10px] text-fg-subtle pt-1 border-t border-border/50">
            {formatCurrency(sub.current_price)} por ciclo · agendou fora dos
            dias do plano? Sem problema: o atendimento é cobrado à parte e a
            gente te avisa.
          </p>
        </div>
      ) : (
        <div className="card p-5 flex items-center justify-between gap-3">
          <div>
            <p
              className="text-base font-bold text-fg"
              style={{ fontFamily: 'var(--font-playfair), serif' }}
            >
              Conheça o Clube de Assinatura
            </p>
            <p className="text-xs text-fg-muted mt-1">
              Cortes todo mês com prioridade e economia. Pergunte ao seu
              barbeiro na próxima visita!
            </p>
          </div>
          <Crown className="w-8 h-8 text-gold flex-shrink-0" />
        </div>
      )}

      {/* CTA AGENDAR */}
      <Link
        href="/cliente/agendar"
        className="btn-gold-shimmer w-full flex items-center justify-center gap-2 py-3.5 text-base"
      >
        <CalendarPlus className="w-5 h-5" />
        <span>Agendar horário</span>
      </Link>

      {/* PRÓXIMOS AGENDAMENTOS */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2
            className="text-base font-semibold text-fg flex items-center gap-2"
            style={{ fontFamily: 'var(--font-playfair), serif' }}
          >
            <Calendar className="w-4 h-4 text-gold" />
            Próximos agendamentos
          </h2>
          <Link
            href="/cliente/agendamentos"
            className="text-[11px] text-gold hover:underline flex items-center gap-0.5"
          >
            Ver todos
            <ChevronRight className="w-3 h-3" />
          </Link>
        </div>

        {!nextAppts || nextAppts.length === 0 ? (
          <div className="card p-6 text-center">
            <Clock className="w-6 h-6 text-fg-subtle mx-auto mb-2" />
            <p className="text-xs text-fg-muted">
              Nenhum agendamento marcado. Que tal garantir seu horário?
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {(nextAppts as any[]).map((a) => {
              const serviceNames = (a.appointment_services ?? [])
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                .map((s: any) => s.services?.name)
                .filter(Boolean)
                .join(' + ');
              return (
                <div
                  key={a.id}
                  className="card p-4 flex items-center gap-3"
                >
                  <div className="w-10 h-10 rounded-md bg-gold/10 text-gold flex items-center justify-center flex-shrink-0">
                    <Scissors className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-fg font-medium truncate">
                      {serviceNames || 'Atendimento'}
                    </p>
                    <p className="text-[11px] text-fg-muted">
                      {fmtDateTime(a.start_at)} · {a.staff?.display_name ?? '-'}
                    </p>
                  </div>
                  {a.subscription_id && (
                    <span className="px-2 py-0.5 rounded-full text-[8px] uppercase tracking-wider font-semibold bg-gold/10 text-gold border border-gold/30 flex-shrink-0">
                      Assinatura
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ÚLTIMAS NOTIFICAÇÕES */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2
            className="text-base font-semibold text-fg flex items-center gap-2"
            style={{ fontFamily: 'var(--font-playfair), serif' }}
          >
            <Bell className="w-4 h-4 text-gold" />
            Últimas novidades
          </h2>
          <Link
            href="/cliente/notificacoes"
            className="text-[11px] text-gold hover:underline flex items-center gap-0.5"
          >
            Ver todas
            <ChevronRight className="w-3 h-3" />
          </Link>
        </div>

        {!lastNotifs || lastNotifs.length === 0 ? (
          <div className="card p-5 text-center">
            <p className="text-xs text-fg-muted">Nada por aqui ainda.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {lastNotifs.map((n) => (
              <div
                key={n.id}
                className={`card p-4 ${!n.read_at ? 'border-gold/30' : ''}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm text-fg font-medium">{n.title}</p>
                  {!n.read_at && (
                    <span className="w-2 h-2 rounded-full bg-gold flex-shrink-0 mt-1.5" />
                  )}
                </div>
                <p className="text-[11px] text-fg-muted mt-1 leading-relaxed">
                  {n.body}
                </p>
                <p className="text-[10px] text-fg-dim mt-1.5">
                  {fmtDateTime(n.created_at)}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
