import Link from 'next/link';
import {
  User,
  Phone,
  Mail,
  Cake,
  Crown,
  Receipt,
  ChevronRight,
  Star,
  Calendar,
} from 'lucide-react';
import { requireCustomer } from '@/lib/customer-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  getActiveSubscription,
  formatAllowedDays,
} from '@/lib/subscriptions';
import { formatCurrency, formatPhone } from '@/lib/utils';
import { SignOutButton } from './_components/signout-button';

export const metadata = { title: 'Perfil' };
export const dynamic = 'force-dynamic';

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR');
}

const TIER_LABELS: Record<string, string> = {
  bronze: 'Bronze',
  silver: 'Prata',
  gold: 'Ouro',
  diamond: 'Diamante',
};

export default async function PerfilPage() {
  const { customer } = await requireCustomer();
  const admin = createAdminClient();
  const sub = await getActiveSubscription(admin, customer.id);

  const tierLabel = TIER_LABELS[customer.loyalty_tier ?? ''] ?? null;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* CABEÇALHO */}
      <div className="card-premium p-6 text-center space-y-3">
        {customer.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={customer.photo_url}
            alt={customer.full_name}
            className="w-24 h-24 rounded-full object-cover border-2 border-gold/50 mx-auto"
          />
        ) : (
          <div
            className="w-24 h-24 rounded-full flex items-center justify-center text-2xl font-bold text-bg mx-auto"
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
          <h1
            className="text-xl font-bold text-fg"
            style={{ fontFamily: 'var(--font-playfair), serif' }}
          >
            {customer.full_name}
          </h1>
          <p className="text-[11px] text-fg-muted mt-1 flex items-center justify-center gap-3 flex-wrap">
            {tierLabel && (
              <span className="flex items-center gap-1 text-gold">
                <Star className="w-3 h-3 fill-current" />
                Nível {tierLabel}
              </span>
            )}
            <span>
              Cliente desde {fmtDate(customer.created_at)}
            </span>
          </p>
        </div>
        <p className="text-[10px] text-fg-subtle">
          Foto desatualizada? Peça pro seu barbeiro trocar na próxima visita.
        </p>
      </div>

      {/* DADOS */}
      <section className="card p-5 space-y-3">
        <h2
          className="text-base font-semibold text-fg"
          style={{ fontFamily: 'var(--font-playfair), serif' }}
        >
          Meus dados
        </h2>
        <div className="space-y-2.5 text-sm">
          <div className="flex items-center gap-3">
            <User className="w-4 h-4 text-gold flex-shrink-0" />
            <span className="text-fg">{customer.full_name}</span>
          </div>
          {customer.phone && (
            <div className="flex items-center gap-3">
              <Phone className="w-4 h-4 text-gold flex-shrink-0" />
              <span className="text-fg">{formatPhone(customer.phone)}</span>
            </div>
          )}
          {customer.email && (
            <div className="flex items-center gap-3">
              <Mail className="w-4 h-4 text-gold flex-shrink-0" />
              <span className="text-fg break-all">{customer.email}</span>
            </div>
          )}
          {customer.birth_date && (
            <div className="flex items-center gap-3">
              <Cake className="w-4 h-4 text-gold flex-shrink-0" />
              <span className="text-fg">
                {new Date(`${customer.birth_date}T12:00:00`).toLocaleDateString(
                  'pt-BR'
                )}
              </span>
            </div>
          )}
        </div>
        <p className="text-[10px] text-fg-subtle pt-2 border-t border-border/50">
          Algum dado errado? Avise a equipe na barbearia que eles corrigem.
        </p>
      </section>

      {/* ASSINATURA */}
      {sub && (
        <section className="card p-5 space-y-2">
          <h2
            className="text-base font-semibold text-fg flex items-center gap-2"
            style={{ fontFamily: 'var(--font-playfair), serif' }}
          >
            <Crown className="w-4 h-4 text-gold" />
            Minha assinatura
          </h2>
          <p className="text-sm text-fg">
            {sub.plan.name} ·{' '}
            <span className="text-gold font-semibold">
              {formatCurrency(sub.current_price)}
            </span>
          </p>
          <p className="text-[11px] text-fg-muted flex items-center gap-1.5">
            <Calendar className="w-3 h-3 text-gold" />
            {formatAllowedDays(sub.plan.allowed_days)} ·{' '}
            {sub.usedInCycle} de {sub.plan.included_uses} usos ·{' '}
            {sub.isExpired ? 'venceu' : 'vence'} em{' '}
            {fmtDate(sub.current_period_end)}
          </p>
        </section>
      )}

      {/* ATALHOS */}
      <Link
        href="/cliente/historico"
        className="card card-hover p-4 flex items-center gap-3"
      >
        <div className="w-10 h-10 rounded-md bg-gold/10 text-gold flex items-center justify-center flex-shrink-0">
          <Receipt className="w-4 h-4" />
        </div>
        <div className="flex-1">
          <p className="text-sm text-fg font-medium">Histórico de atendimentos</p>
          <p className="text-[11px] text-fg-subtle">
            {customer.total_appointments} visitas ·{' '}
            {formatCurrency(Number(customer.total_spent ?? 0))} no total
          </p>
        </div>
        <ChevronRight className="w-4 h-4 text-fg-subtle" />
      </Link>

      <SignOutButton />

      <p className="text-[10px] text-fg-dim text-center tracking-[0.3em] uppercase pt-2">
        Barbearia do Johnn · Taguatinga
      </p>
    </div>
  );
}
