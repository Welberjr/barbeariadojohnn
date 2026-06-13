import Link from 'next/link';
import {
  CalendarPlus, Scissors, Clock, ChevronRight, Trophy,
  Crown, Flame, Star, Target, Zap, Gift, CheckCircle2,
} from 'lucide-react';
import { requireCustomer } from '@/lib/customer-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { getActiveSubscription, formatAllowedDays } from '@/lib/subscriptions';
import { getRankings } from '@/lib/loyalty';
import { cn, formatCurrency } from '@/lib/utils';
import { Raspadinha } from './_components/raspadinha';

export const metadata = { title: 'Início' };
export const dynamic = 'force-dynamic';

const TIERS = [
  { key: 'bronze',  label: 'Bronze',   min: 0,    max: 500,  color: '#CD7F32', icon: '🥉' },
  { key: 'silver',  label: 'Prata',    min: 500,  max: 1500, color: '#C0C0C0', icon: '🥈' },
  { key: 'gold',    label: 'Ouro',     min: 1500, max: 4000, color: '#F5C518', icon: '🥇' },
  { key: 'diamond', label: 'Diamante', min: 4000, max: 4000, color: '#B9F2FF', icon: '💎' },
];

function getTier(lifetime: number) {
  return [...TIERS].reverse().find((t) => lifetime >= t.min) ?? TIERS[0];
}

function fmtDateTime(iso: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'short', day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso));
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR');
}

function positionBadge(pos: number) {
  if (pos === 1) return '🥇';
  if (pos === 2) return '🥈';
  if (pos === 3) return '🥉';
  return `${pos}º`;
}

export default async function ClienteHomePage() {
  const { customer } = await requireCustomer();
  const admin = createAdminClient();

  const [{ data: loyalty }, sub, { data: nextAppts }, rankings] = await Promise.all([
    admin.from('loyalty_points').select('balance, lifetime_earned')
      .eq('customer_id', customer.id).maybeSingle(),
    getActiveSubscription(admin, customer.id),
    admin.from('appointments')
      .select(`id, start_at, status, staff:staff (display_name),
               appointment_services ( services:services (name) )`)
      .eq('customer_id', customer.id).eq('status', 'scheduled')
      .gte('start_at', new Date().toISOString())
      .order('start_at', { ascending: true }).limit(2),
    getRankings({ limit: 10, highlightCustomerId: customer.id }),
  ]);

  const balance  = Number(loyalty?.balance ?? customer.loyalty_points ?? 0);
  const lifetime = Number(loyalty?.lifetime_earned ?? 0);
  const firstName = (customer.full_name ?? 'Cliente').trim().split(/\s+/)[0];
  const tier = getTier(lifetime);
  const tierIndex  = TIERS.findIndex((t) => t.key === tier.key);
  const nextTier   = TIERS[tierIndex + 1] ?? null;
  const tierPct    = nextTier
    ? Math.min(100, ((lifetime - tier.min) / Math.max(1, nextTier.min - tier.min)) * 100)
    : 100;
  const ptsFaltamTier = nextTier ? Math.max(0, nextTier.min - lifetime) : 0;

  // Streak mensal
  const { data: visitas } = await admin.from('comandas').select('closed_at')
    .eq('customer_id', customer.id).eq('status', 'closed')
    .order('closed_at', { ascending: false }).limit(12);
  let streak = 0;
  if (visitas?.length) {
    const months = new Set(visitas.map((v) => {
      const d = new Date(v.closed_at!);
      return `${d.getFullYear()}-${d.getMonth()}`;
    }));
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      if (months.has(`${d.getFullYear()}-${d.getMonth()}`)) streak++;
      else break;
    }
  }

  // Previsao do proximo corte
  let previsaoDias: number | null = null;
  if (visitas && visitas.length >= 2) {
    const diffs: number[] = [];
    for (let i = 0; i < Math.min(visitas.length - 1, 4); i++) {
      const a = new Date(visitas[i].closed_at!);
      const b = new Date(visitas[i + 1].closed_at!);
      diffs.push(Math.abs((a.getTime() - b.getTime()) / 86400000));
    }
    const avg = diffs.reduce((s, d) => s + d, 0) / diffs.length;
    const ultima = new Date(visitas[0].closed_at!);
    const ideal  = new Date(ultima.getTime() + avg * 86400000);
    const hoje   = new Date();
    previsaoDias = Math.round((ideal.getTime() - hoje.getTime()) / 86400000);
  }

  // Proximo premio
  const { data: rewards } = await admin.from('loyalty_rewards')
    .select('name, points_required').eq('barbershop_id', '11111111-1111-1111-1111-111111111111')
    .eq('active', true).gt('points_required', balance)
    .order('points_required', { ascending: true }).limit(1);
  const nextReward = rewards?.[0] ?? null;
  const rewardPct  = nextReward
    ? Math.min(100, (balance / nextReward.points_required) * 100) : 0;

  const myPos  = rankings.allTime.find((r) => r.customer_id === customer.id) ?? rankings.myAllTime;
  const top5   = rankings.allTime.slice(0, 5);
  const usagePct = sub ? Math.min(100, (sub.usedInCycle / Math.max(1, sub.plan.included_uses)) * 100) : 0;

  // Missoes (logica simples baseada em dados existentes)
  const totalVisitas = visitas?.length ?? 0;
  const missions = [
    { done: true,           pts: 0,   label: 'Criar conta no app' },
    { done: totalVisitas >= 1, pts: 100, label: 'Fazer o 1° agendamento' },
    { done: totalVisitas >= 3, pts: 150, label: '3 visitas realizadas' },
    { done: streak >= 2,    pts: 200, label: '2 meses seguidos' },
    { done: !!sub,          pts: 300, label: 'Assinar o Clube VIP' },
  ].filter(Boolean);
  const doneMissions   = missions.filter((m) => m.done).length;
  const totalMissions  = missions.length;
  return (
    <div className="space-y-4 animate-fade-in pb-2">

      {/* ══════════ HERO ══════════ */}
      <div
        className="relative rounded-2xl overflow-hidden px-5 pt-6 pb-5"
        style={{ background: 'linear-gradient(135deg, #0d0d0d 0%, #1a1204 60%, #2a1c00 100%)' }}
      >
        {/* brilho decorativo */}
        <div className="absolute top-0 right-0 w-40 h-40 rounded-full opacity-20 blur-3xl"
          style={{ background: 'radial-gradient(circle, #F5C518, transparent)' }} />

        <div className="relative flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            {customer.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={customer.photo_url} alt={customer.full_name}
                className="w-14 h-14 rounded-full object-cover border-2 border-gold/50" />
            ) : (
              <div className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold text-bg flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, #D4A04F 0%, #F5C518 100%)' }}>
                {customer.full_name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
              </div>
            )}
            <div>
              <p className="text-[10px] tracking-[0.25em] uppercase text-gold/70 font-semibold">Bem-vindo de volta</p>
              <h1 className="text-2xl font-bold text-fg leading-tight" style={{ fontFamily: 'var(--font-playfair), serif' }}>
                {firstName}
              </h1>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-base">{tier.icon}</span>
                <span className="text-[11px] font-semibold" style={{ color: tier.color }}>{tier.label}</span>
                {streak >= 2 && (
                  <span className="flex items-center gap-0.5 text-[11px] text-orange-400 font-semibold ml-1">
                    <Flame className="w-3 h-3" />{streak} meses
                  </span>
                )}
              </div>
            </div>
          </div>
          {/* Pontos saldo */}
          <div className="text-right">
            <p className="text-[9px] uppercase tracking-wider text-fg-dim">Saldo</p>
            <p className="text-xl font-bold text-gold leading-none" style={{ fontFamily: 'var(--font-playfair), serif' }}>
              {balance.toLocaleString('pt-BR')}
            </p>
            <p className="text-[9px] text-fg-subtle">pontos</p>
          </div>
        </div>

        {/* Barra de nivel */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[10px]">
            <span style={{ color: tier.color }} className="font-semibold">{tier.label}</span>
            {nextTier ? (
              <span className="text-fg-subtle">{ptsFaltamTier.toLocaleString('pt-BR')} pts para {nextTier.label}</span>
            ) : (
              <span className="text-gold font-semibold">Nível máximo! 🏆</span>
            )}
          </div>
          <div className="h-2 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full rounded-full transition-all"
              style={{ width: `${tierPct}%`, background: `linear-gradient(90deg, ${tier.color}80, ${tier.color})` }} />
          </div>
        </div>
      </div>

      {/* ══════════ AGENDAR (botão principal) ══════════ */}
      {previsaoDias !== null && previsaoDias <= 7 && (
        <div className="card px-4 py-3 flex items-center gap-3 border-gold/30 bg-gold/5">
          <Zap className="w-4 h-4 text-gold flex-shrink-0" />
          <p className="text-sm text-fg flex-1">
            {previsaoDias <= 0
              ? 'Seu corte ideal é hoje! 💈'
              : `Seu próximo corte ideal: em ${previsaoDias} dias`}
          </p>
          <Link href="/cliente/agendar" className="text-[11px] text-gold font-semibold hover:underline whitespace-nowrap">
            Agendar →
          </Link>
        </div>
      )}

      <Link href="/cliente/agendar"
        className="btn-gold-shimmer w-full flex items-center justify-center gap-2 py-4 text-base rounded-xl">
        <CalendarPlus className="w-5 h-5" />
        <span>Agendar horário</span>
      </Link>

      {/* ══════════ PRÓXIMOS AGENDAMENTOS ══════════ */}
      {nextAppts && nextAppts.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-fg-muted uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-gold" />Próximos
            </p>
            <Link href="/cliente/agendamentos" className="text-[11px] text-gold flex items-center gap-0.5">
              Ver todos <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {(nextAppts as any[]).map((a) => {
            const svc = (a.appointment_services ?? [])
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              .map((s: any) => s.services?.name).filter(Boolean).join(' + ');
            return (
              <div key={a.id} className="card px-4 py-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-md bg-gold/10 text-gold flex items-center justify-center flex-shrink-0">
                  <Scissors className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-fg font-medium truncate">{svc || 'Atendimento'}</p>
                  <p className="text-[11px] text-fg-muted">{fmtDateTime(a.start_at)} · {a.staff?.display_name ?? '—'}</p>
                </div>
              </div>
            );
          })}
        </section>
      )}
      {/* ══════════ RANKING ══════════ */}
      <section className="card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-fg flex items-center gap-2" style={{ fontFamily: 'var(--font-playfair), serif' }}>
            <Trophy className="w-4 h-4 text-gold" />Ranking Geral
          </h2>
          <Link href="/cliente/ranking" className="text-[11px] text-gold flex items-center gap-0.5">
            Completo <ChevronRight className="w-3 h-3" />
          </Link>
        </div>

        {top5.length === 0 ? (
          <p className="text-xs text-fg-subtle text-center py-2">Seja o primeiro a pontuar!</p>
        ) : (
          <div className="space-y-1.5">
            {top5.map((r) => {
              const isMe = r.customer_id === customer.id;
              const initials = r.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();
              return (
                <div key={r.customer_id}
                  className={cn(
                    'flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors',
                    isMe ? 'bg-gold/12 border border-gold/35' : r.position <= 3 ? 'bg-bg-elevated' : ''
                  )}>
                  <span className="text-base w-7 text-center flex-shrink-0">{positionBadge(r.position)}</span>
                  {r.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.photo_url} alt={r.full_name}
                      className="w-7 h-7 rounded-full object-cover border border-gold/20 flex-shrink-0" />
                  ) : (
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-bold text-bg flex-shrink-0"
                      style={{ background: isMe ? 'linear-gradient(135deg, #D4A04F, #F5C518)' : '#333' }}>
                      {initials}
                    </div>
                  )}
                  <p className={cn('flex-1 text-sm truncate', isMe ? 'text-gold font-bold' : 'text-fg')}>
                    {r.full_name}{isMe ? ' (você)' : ''}
                  </p>
                  <p className="text-sm font-bold text-gold flex-shrink-0" style={{ fontFamily: 'var(--font-playfair), serif' }}>
                    {r.points.toLocaleString('pt-BR')}
                    <span className="text-[9px] text-fg-dim font-normal ml-0.5">pts</span>
                  </p>
                </div>
              );
            })}
          </div>
        )}

        {/* Minha posicao se estiver fora do top 5 */}
        {myPos && !top5.some((r) => r.customer_id === customer.id) && (
          <div className="pt-2 border-t border-border/50 flex items-center gap-2.5 px-3 py-2 rounded-lg bg-gold/10 border border-gold/30">
            <span className="text-sm font-bold text-gold w-7 text-center">{myPos.position}º</span>
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-bold text-bg flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #D4A04F, #F5C518)' }}>
              {customer.full_name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
            </div>
            <p className="flex-1 text-sm text-gold font-bold truncate">Você · {myPos.position}º lugar</p>
            <p className="text-sm font-bold text-gold">{myPos.points.toLocaleString('pt-BR')}
              <span className="text-[9px] text-fg-dim font-normal ml-0.5">pts</span>
            </p>
          </div>
        )}

        {/* Faltam X para top 10 */}
        {myPos && myPos.position > 10 && rankings.allTime[9] && (
          <p className="text-[11px] text-fg-subtle text-center pt-1">
            Faltam <strong className="text-gold">{(rankings.allTime[9].points - balance).toLocaleString('pt-BR')} pts</strong> para entrar no Top 10
          </p>
        )}
      </section>

      {/* ══════════ PRÓXIMA RECOMPENSA ══════════ */}
      {nextReward ? (
        <div className="card p-4 space-y-2.5">
          <div className="flex items-center gap-2">
            <Gift className="w-4 h-4 text-gold" />
            <p className="text-sm font-bold text-fg">Próxima recompensa</p>
          </div>
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-fg">{nextReward.name}</p>
            <p className="text-[11px] text-fg-muted whitespace-nowrap">
              faltam <strong className="text-gold">{(nextReward.points_required - balance).toLocaleString('pt-BR')} pts</strong>
            </p>
          </div>
          <div className="h-2 rounded-full bg-bg-elevated border border-border overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${rewardPct}%`, background: 'linear-gradient(90deg, #B8862A, #F5C518)' }} />
          </div>
          <p className="text-[10px] text-fg-subtle">{rewardPct.toFixed(0)}% do caminho — continue vindo!</p>
        </div>
      ) : null}

      {/* ══════════ RASPADINHA ══════════ */}
      <Raspadinha customerId={customer.id} />

      {/* ══════════ MISSOES ══════════ */}
      <section className="card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-fg flex items-center gap-2">
            <Target className="w-4 h-4 text-gold" />Missões
          </h2>
          <span className="text-[11px] text-fg-muted">{doneMissions}/{totalMissions} completas</span>
        </div>
        <div className="h-1.5 rounded-full bg-bg-elevated overflow-hidden">
          <div className="h-full rounded-full bg-gold/70 transition-all"
            style={{ width: `${(doneMissions / totalMissions) * 100}%` }} />
        </div>
        <div className="space-y-2">
          {missions.map((m, i) => (
            <div key={i} className={cn(
              'flex items-center gap-3 p-2.5 rounded-lg',
              m.done ? 'bg-success/8 border border-success/20' : 'bg-bg-elevated'
            )}>
              {m.done
                ? <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />
                : <div className="w-4 h-4 rounded-full border-2 border-border flex-shrink-0" />}
              <p className={cn('text-sm flex-1', m.done ? 'text-fg-muted line-through' : 'text-fg')}>
                {m.label}
              </p>
              {m.pts > 0 && (
                <span className={cn('text-[11px] font-bold px-2 py-0.5 rounded-full',
                  m.done ? 'text-fg-dim bg-bg' : 'text-gold bg-gold/10')}>
                  +{m.pts}pts
                </span>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ══════════ ASSINATURA ══════════ */}
      {sub ? (
        <div className="card p-4 space-y-3 border-gold/20" style={{
          background: 'linear-gradient(135deg, rgba(212,160,79,0.08) 0%, transparent 100%)'
        }}>
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-[10px] text-gold tracking-[0.2em] uppercase font-semibold flex items-center gap-1.5">
                <Crown className="w-3 h-3" />Minha assinatura
              </p>
              <h3 className="text-base font-bold text-fg mt-0.5" style={{ fontFamily: 'var(--font-playfair), serif' }}>
                {sub.plan.name}
              </h3>
            </div>
            <span className={cn('px-2 py-0.5 rounded-full text-[9px] uppercase tracking-wider font-semibold border',
              sub.isExpired ? 'bg-danger/10 text-danger border-danger/30' : 'bg-success/10 text-success border-success/30')}>
              {sub.isExpired ? 'Vencida' : 'Ativa'}
            </span>
          </div>
          <div>
            <div className="flex items-center justify-between text-[11px] mb-1.5">
              <span className="text-fg-muted">Usos do ciclo</span>
              <span className="text-fg font-semibold">{sub.usedInCycle} de {sub.plan.included_uses}</span>
            </div>
            <div className="h-2 rounded-full bg-bg-elevated border border-border overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${usagePct}%`, background: 'linear-gradient(90deg, #D4A04F, #F5C518)' }} />
            </div>
            {sub.usesLeft > 0 && !sub.isExpired && (
              <p className="text-[10px] text-fg-subtle mt-1.5">
                Você ainda tem <strong>{sub.usesLeft}</strong> {sub.usesLeft === 1 ? 'atendimento' : 'atendimentos'} para usar
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div>
              <p className="text-[9px] uppercase tracking-wider text-fg-dim">
                {sub.isExpired ? 'Venceu em' : 'Vence em'}
              </p>
              <p className={cn('text-sm font-semibold', sub.isExpired ? 'text-danger' : 'text-fg')}>
                {fmtDate(sub.current_period_end)}
              </p>
            </div>
            <div>
              <p className="text-[9px] uppercase tracking-wider text-fg-dim">Dias do plano</p>
              <p className="text-sm font-semibold text-gold">{formatAllowedDays(sub.plan.allowed_days)}</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="card p-4 flex items-center justify-between gap-3 border-gold/15">
          <div>
            <p className="text-sm font-bold text-fg">Conheça o Clube VIP</p>
            <p className="text-xs text-fg-muted mt-0.5">Cortes mensais com prioridade e economia.</p>
          </div>
          <Crown className="w-8 h-8 text-gold flex-shrink-0" />
        </div>
      )}

      {/* ══════════ CONQUISTAS ══════════ */}
      <section className="space-y-2">
        <p className="text-xs font-semibold text-fg-muted uppercase tracking-wider flex items-center gap-1.5">
          <Star className="w-3.5 h-3.5 text-gold" />Conquistas
        </p>
        <div className="grid grid-cols-3 gap-2.5">
          {[
            { icon: '💈', label: 'Primeiro Corte',    done: (visitas?.length ?? 0) >= 1 },
            { icon: '🔥', label: '2 Meses Seguidos',  done: streak >= 2 },
            { icon: '👑', label: 'Clube VIP',          done: !!sub },
            { icon: '🥇', label: 'Top 10 Ranking',    done: !!myPos && myPos.position <= 10 },
            { icon: '💰', label: '500 Pontos',         done: lifetime >= 500 },
            { icon: '💎', label: 'Nível Ouro',         done: lifetime >= 1500 },
          ].map((c, i) => (
            <div key={i} className={cn(
              'card p-3 flex flex-col items-center gap-1.5 text-center transition-all',
              c.done ? 'border-gold/30 bg-gold/5' : 'opacity-40 grayscale'
            )}>
              <span className="text-2xl">{c.icon}</span>
              <p className={cn('text-[10px] leading-tight', c.done ? 'text-fg font-medium' : 'text-fg-dim')}>
                {c.label}
              </p>
              {!c.done && <p className="text-[9px] text-fg-subtle">Bloqueada</p>}
            </div>
          ))}
        </div>
      </section>

    </div>
  );
}