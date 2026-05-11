'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Search,
  Phone,
  Mail,
  Calendar,
  Crown,
  TrendingUp,
  Heart,
  Star,
} from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';

interface Customer {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  cpf: string | null;
  birth_date: string | null;
  tier: 'new' | 'regular' | 'vip' | 'inactive' | 'churned';
  loyalty_tier: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';
  loyalty_points: number;
  total_appointments: number;
  total_spent: number;
  last_visit_at: string | null;
  photo_url: string | null;
  active: boolean;
  created_at: string;
}

const tierConfig: Record<
  Customer['tier'],
  { label: string; color: string; icon: typeof Crown }
> = {
  new: { label: 'Novo', color: 'bg-success/10 text-success border-success/30', icon: Heart },
  regular: { label: 'Recorrente', color: 'bg-info/10 text-info border-info/30', icon: TrendingUp },
  vip: { label: 'VIP', color: 'bg-gold/10 text-gold border-gold/30', icon: Crown },
  inactive: { label: 'Inativo', color: 'bg-fg-dim/10 text-fg-subtle border-border-strong', icon: Heart },
  churned: { label: 'Perdido', color: 'bg-danger/10 text-danger border-danger/30', icon: Heart },
};

const loyaltyTierConfig: Record<Customer['loyalty_tier'], string> = {
  bronze: 'text-amber-700',
  silver: 'text-gray-300',
  gold: 'text-gold',
  platinum: 'text-cyan-300',
  diamond: 'text-purple-300',
};

interface CustomersListProps {
  customers: Customer[];
  initialQuery: string;
  initialTier: string;
}

export function CustomersList({ customers, initialQuery, initialTier }: CustomersListProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState(initialQuery);
  const [tier, setTier] = useState(initialTier);

  function applyFilters(newQuery?: string, newTier?: string) {
    const params = new URLSearchParams();
    const q = newQuery ?? query;
    const t = newTier ?? tier;
    if (q) params.set('q', q);
    if (t && t !== 'all') params.set('tier', t);

    startTransition(() => {
      router.push(`/admin/clientes${params.toString() ? '?' + params.toString() : ''}`);
    });
  }

  return (
    <div className="space-y-4">
      {/* BARRA DE BUSCA + FILTROS */}
      <div className="card p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-subtle" />
          <input
            type="text"
            placeholder="Buscar por nome, telefone ou e-mail..."
            className="input pl-10 w-full"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') applyFilters();
            }}
          />
        </div>

        <div className="flex gap-2 flex-wrap">
          {[
            { v: 'all', label: 'Todos' },
            { v: 'new', label: 'Novos' },
            { v: 'regular', label: 'Recorrentes' },
            { v: 'vip', label: 'VIPs' },
            { v: 'inactive', label: 'Inativos' },
          ].map((opt) => (
            <button
              key={opt.v}
              type="button"
              onClick={() => {
                setTier(opt.v);
                applyFilters(undefined, opt.v);
              }}
              className={cn(
                'px-3 py-2 rounded-md text-xs font-medium transition-all',
                tier === opt.v
                  ? 'bg-gold text-bg shadow-gold'
                  : 'bg-bg-elevated text-fg-muted hover:text-fg hover:bg-bg-surface border border-border'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* RESULTADOS */}
      <div className="flex items-center justify-between text-xs text-fg-subtle">
        <p>
          {isPending ? 'Buscando...' : `${customers.length} cliente${customers.length === 1 ? '' : 's'}`}
        </p>
      </div>

      {/* CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {customers.map((c) => {
          const tierData = tierConfig[c.tier];
          const TierIcon = tierData.icon;
          const initials = c.full_name
            .split(' ')
            .map((n) => n[0])
            .join('')
            .slice(0, 2)
            .toUpperCase();

          return (
            <Link
              key={c.id}
              href={`/admin/clientes/${c.id}`}
              className={cn(
                'card card-hover p-5 group block',
                !c.active && 'opacity-50'
              )}
            >
              {/* HEADER */}
              <div className="flex items-start gap-3 mb-3">
                {c.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={c.photo_url}
                    alt={c.full_name}
                    className="w-12 h-12 rounded-full object-cover border-2 border-gold/30"
                  />
                ) : (
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold text-bg flex-shrink-0"
                    style={{
                      background: 'linear-gradient(135deg, #D4A04F 0%, #F5C518 100%)',
                    }}
                  >
                    {initials}
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <h3
                    className="text-base font-bold text-fg leading-tight truncate"
                    style={{ fontFamily: 'var(--font-playfair), serif' }}
                  >
                    {c.full_name}
                  </h3>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-medium border tracking-wider uppercase',
                        tierData.color
                      )}
                    >
                      <TierIcon className="w-2.5 h-2.5" />
                      {tierData.label}
                    </span>
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 text-[9px] uppercase tracking-wider',
                        loyaltyTierConfig[c.loyalty_tier]
                      )}
                    >
                      <Star className="w-2.5 h-2.5 fill-current" />
                      {c.loyalty_tier}
                    </span>
                  </div>
                </div>
              </div>

              {/* CONTATO */}
              <div className="space-y-1 mb-3">
                {c.phone && (
                  <div className="flex items-center gap-2 text-[11px] text-fg-subtle">
                    <Phone className="w-3 h-3" />
                    <span>{c.phone}</span>
                  </div>
                )}
                {c.email && (
                  <div className="flex items-center gap-2 text-[11px] text-fg-subtle">
                    <Mail className="w-3 h-3" />
                    <span className="truncate">{c.email}</span>
                  </div>
                )}
                {c.last_visit_at && (
                  <div className="flex items-center gap-2 text-[11px] text-fg-subtle">
                    <Calendar className="w-3 h-3" />
                    <span>
                      Última visita:{' '}
                      {new Date(c.last_visit_at).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                )}
              </div>

              {/* MÉTRICAS */}
              <div className="grid grid-cols-3 gap-2 pt-3 border-t border-border/60">
                <div>
                  <p className="text-[8px] uppercase tracking-wider text-fg-dim">
                    Visitas
                  </p>
                  <p
                    className="text-sm font-bold text-fg"
                    style={{ fontFamily: 'var(--font-playfair), serif' }}
                  >
                    {c.total_appointments}
                  </p>
                </div>
                <div>
                  <p className="text-[8px] uppercase tracking-wider text-fg-dim">
                    Total gasto
                  </p>
                  <p
                    className="text-sm font-bold text-gold"
                    style={{ fontFamily: 'var(--font-playfair), serif' }}
                  >
                    {formatCurrency(Number(c.total_spent))}
                  </p>
                </div>
                <div>
                  <p className="text-[8px] uppercase tracking-wider text-fg-dim">
                    Pontos
                  </p>
                  <p
                    className="text-sm font-bold text-fg"
                    style={{ fontFamily: 'var(--font-playfair), serif' }}
                  >
                    {c.loyalty_points}
                  </p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
