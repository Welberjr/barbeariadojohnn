import Link from 'next/link';
import {
  ChevronRight,
  Crown,
  Flame,
  Gift,
  Star,
  Target,
  Trophy,
} from 'lucide-react';
import { requireCustomer } from '@/lib/customer-auth';
import { getRankings } from '@/lib/loyalty';
import { getActiveSubscription, formatAllowedDays } from '@/lib/subscriptions';
import { createAdminClient } from '@/lib/supabase/admin';
import { cn } from '@/lib/utils';

export const metadata = { title: 'Benefícios' };
export const dynamic = 'force-dynamic';

const TIERS = [
  { key: 'bronze', label: 'Bronze', min: 0, max: 500, color: '#CD7F32', icon: '🥉' },
  { key: 'silver', label: 'Prata', min: 500, max: 1500, color: '#C0C0C0', icon: '🥈' },
  { key: 'gold', label: 'Ouro', min: 1500, max: 4000, color: '#F5C518', icon: '🥇' },
  { key: 'diamond', label: 'Diamante', min: 4000, max: 4000, color: '#B9F2FF', icon: '💎' },
];

function getTier(lifetime: number) {
  return [...TIERS].reverse().find((tier) => lifetime >= tier.min) ?? TIERS[0];
}

export default async function BeneficiosPage() {
  const { customer } = await requireCustomer();
  const admin = createAdminClient();

  const [{ data: loyalty }, subscription, { data: visits }, { data: rewards }, rankings] = await Promise.all([
    admin
      .from('loyalty_points')
      .select('balance, lifetime_earned')
      .eq('customer_id', customer.id)
      .maybeSingle(),
    getActiveSubscription(admin, customer.id),
    admin
      .from('comandas')
      .select('closed_at')
      .eq('customer_id', customer.id)
      .eq('status', 'closed')
      .order('closed_at', { ascending: false })
      .limit(12),
    admin
      .from('loyalty_rewards')
      .select('name, points_required')
      .eq('barbershop_id', '11111111-1111-1111-1111-111111111111')
      .eq('active', true)
      .order('points_required', { ascending: true }),
    getRankings({ limit: 10, highlightCustomerId: customer.id, includeSemester: false }),
  ]);

  const balance = Number(loyalty?.balance ?? customer.loyalty_points ?? 0);
  const lifetime = Number(loyalty?.lifetime_earned ?? 0);
  const tier = getTier(lifetime);
  const tierIndex = TIERS.findIndex((item) => item.key === tier.key);
  const nextTier = TIERS[tierIndex + 1] ?? null;
  const tierProgress = nextTier
    ? Math.min(100, ((lifetime - tier.min) / Math.max(1, nextTier.min - tier.min)) * 100)
    : 100;
  const nextReward = rewards?.find((reward) => Number(reward.points_required) > balance) ?? null;
  const rewardProgress = nextReward
    ? Math.min(100, (balance / Number(nextReward.points_required)) * 100)
    : 100;

  let streak = 0;
  if (visits?.length) {
    const months = new Set(visits.map((visit) => {
      const date = new Date(visit.closed_at!);
      return `${date.getFullYear()}-${date.getMonth()}`;
    }));
    const now = new Date();
    for (let index = 0; index < 12; index++) {
      const month = new Date(now.getFullYear(), now.getMonth() - index, 1);
      if (months.has(`${month.getFullYear()}-${month.getMonth()}`)) streak++;
      else break;
    }
  }

  const totalVisits = visits?.length ?? 0;
  const myRank = rankings.myAllTime;
  const missions = [
    { done: true, points: 0, label: 'Criar conta no app', icon: '✅' },
    { done: totalVisits >= 1, points: 100, label: 'Primeira visita registrada', icon: '💈' },
    { done: totalVisits >= 3, points: 150, label: '3 visitas realizadas', icon: '🔁' },
    { done: totalVisits >= 5, points: 200, label: '5 visitas realizadas', icon: '⭐' },
    { done: totalVisits >= 10, points: 500, label: '10 visitas — cliente fiel', icon: '🏅' },
    { done: balance >= 100, points: 0, label: 'Acumular 100 pontos', icon: '💰' },
    { done: streak >= 2, points: 200, label: '2 meses consecutivos', icon: '🔥' },
    { done: !!subscription, points: 300, label: 'Assinar o Clube VIP', icon: '👑' },
    { done: lifetime >= 1500, points: 0, label: 'Atingir nível Ouro', icon: '🥇' },
    { done: !!myRank && myRank.position <= 10, points: 0, label: 'Entrar no Top 10 do ranking', icon: '🎯' },
  ];
  const completedMissions = missions.filter((mission) => mission.done).length;

  const achievements = [
    { icon: '💈', label: 'Primeiro Corte', done: totalVisits >= 1 },
    { icon: '🔥', label: '2 Meses Seguidos', done: streak >= 2 },
    { icon: '👑', label: 'Clube VIP', done: !!subscription },
    { icon: '🥇', label: 'Top 10 Ranking', done: !!myRank && myRank.position <= 10 },
    { icon: '💰', label: '500 Pontos', done: lifetime >= 500 },
    { icon: '💎', label: 'Nível Ouro', done: lifetime >= 1500 },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-gold">Fidelidade</p>
        <h1 className="text-2xl font-bold text-fg" style={{ fontFamily: 'var(--font-playfair), serif' }}>
          Seus benefícios
        </h1>
        <p className="mt-1 text-xs text-fg-muted">Pontos, Clube VIP, conquistas e recompensas em um só lugar.</p>
      </div>

      <section className="card-premium space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-fg-dim">Seu nível</p>
            <p className="mt-1 flex items-center gap-2 text-xl font-bold text-fg" style={{ fontFamily: 'var(--font-playfair), serif' }}>
              <span>{tier.icon}</span>
              <span style={{ color: tier.color }}>{tier.label}</span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wider text-fg-dim">Saldo</p>
            <p className="text-xl font-bold text-gold" style={{ fontFamily: 'var(--font-playfair), serif' }}>
              {balance.toLocaleString('pt-BR')} pts
            </p>
          </div>
        </div>
        <div>
          <div className="mb-1.5 flex items-center justify-between text-[10px]">
            <span style={{ color: tier.color }} className="font-semibold">{tier.label}</span>
            <span className="text-fg-subtle">
              {nextTier ? `${Math.max(0, nextTier.min - lifetime).toLocaleString('pt-BR')} pts para ${nextTier.label}` : 'Nível máximo'}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full" style={{ width: `${tierProgress}%`, background: `linear-gradient(90deg, ${tier.color}80, ${tier.color})` }} />
          </div>
        </div>
      </section>

      {nextReward && (
        <section className="card space-y-3 p-4">
          <div className="flex items-center gap-2">
            <Gift className="h-4 w-4 text-gold" />
            <p className="text-sm font-bold text-fg">Próxima recompensa</p>
          </div>
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-fg">{nextReward.name}</p>
            <p className="text-[11px] text-fg-muted">
              faltam <strong className="text-gold">{(Number(nextReward.points_required) - balance).toLocaleString('pt-BR')} pts</strong>
            </p>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-bg-elevated">
            <div className="h-full rounded-full bg-gold" style={{ width: `${rewardProgress}%` }} />
          </div>
        </section>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Link href="/cliente/ranking" className="card card-hover p-4">
          <Trophy className="h-5 w-5 text-gold" />
          <p className="mt-3 text-sm font-semibold text-fg">Ranking</p>
          <p className="mt-0.5 text-[11px] text-fg-muted">
            {myRank ? `${myRank.position}º lugar geral` : 'Veja sua posição'}
          </p>
        </Link>
        <Link href="/cliente/clube" className="card card-hover p-4">
          <Crown className="h-5 w-5 text-gold" />
          <p className="mt-3 text-sm font-semibold text-fg">Clube VIP</p>
          <p className="mt-0.5 text-[11px] text-fg-muted">
            {subscription ? `${subscription.usesLeft} usos disponíveis` : 'Conheça os planos'}
          </p>
        </Link>
      </div>

      {subscription && (
        <Link href="/cliente/clube" className="card card-hover flex items-center gap-3 border-gold/20 p-4">
          <Crown className="h-5 w-5 flex-shrink-0 text-gold" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-fg">{subscription.plan.name}</p>
            <p className="text-[11px] text-fg-muted">
              {subscription.usedInCycle} de {subscription.plan.included_uses} usos · {formatAllowedDays(subscription.plan.allowed_days)}
            </p>
          </div>
          <ChevronRight className="h-4 w-4 text-fg-subtle" />
        </Link>
      )}

      <section className="card space-y-3 p-4">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-bold text-fg">
            <Target className="h-4 w-4 text-gold" />
            Missões
          </h2>
          <span className="text-[11px] text-fg-muted">{completedMissions}/{missions.length} completas</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-bg-elevated">
          <div className="h-full rounded-full bg-gold/70" style={{ width: `${(completedMissions / missions.length) * 100}%` }} />
        </div>
        <div className="space-y-2">
          {missions.map((mission) => (
            <div key={mission.label} className={cn('flex items-center gap-3 rounded-lg p-2.5', mission.done ? 'border border-success/20 bg-success/8' : 'bg-bg-elevated')}>
              <span className="text-lg">{mission.icon}</span>
              <p className={cn('flex-1 text-sm', mission.done ? 'text-fg-muted line-through' : 'text-fg')}>
                {mission.label}
              </p>
              {mission.points > 0 && <span className="text-[11px] font-bold text-gold">+{mission.points} pts</span>}
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-fg-muted">
          <Star className="h-3.5 w-3.5 text-gold" />
          Conquistas
        </p>
        <div className="grid grid-cols-3 gap-2.5">
          {achievements.map((achievement) => (
            <div key={achievement.label} className={cn('card flex flex-col items-center gap-1.5 p-3 text-center', achievement.done ? 'border-gold/30 bg-gold/5' : 'grayscale opacity-40')}>
              <span className="text-2xl">{achievement.icon}</span>
              <p className="text-[10px] leading-tight text-fg">{achievement.label}</p>
              {!achievement.done && <p className="text-[9px] text-fg-subtle">Bloqueada</p>}
            </div>
          ))}
        </div>
      </section>

      {streak >= 2 && (
        <div className="flex items-center gap-2 text-xs text-orange-400">
          <Flame className="h-4 w-4" />
          Você está há {streak} meses seguidos com a gente.
        </div>
      )}
    </div>
  );
}
