'use client';

import { useConfirm } from '@/components/confirm-dialog';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  Crown,
  Plus,
  X,
  Check,
  Loader2,
  Calendar,
  CreditCard,
  Banknote,
  Smartphone,
  Star,
  AlertTriangle,
  RotateCcw,
  Pencil,
  Wallet,
  Users,
  Ban,
  Scissors,
  Search,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { cn, formatCurrency, formatPhone } from '@/lib/utils';
import { formatAllowedDays } from '@/lib/subscriptions';
import {
  createSubscription,
  cancelSubscription,
  reactivateSubscription,
  registerSubscriptionPayment,
  previewSettlement,
  deletePlan,
  type SettlementPreview,
} from '../actions';

// ---------------------------------------------------------------------------
// Tipos das props (montadas no server em page.tsx)
// ---------------------------------------------------------------------------

interface Plan {
  id: string;
  name: string;
  description: string | null;
  price: number;
  period: string;
  allowed_days: number[];
  included_uses: number;
  barber_share_percent: number;
  accumulate_unused: boolean;
  show_on_public_menu: boolean;
  active: boolean;
  display_order: number;
}

interface SubscriptionRow {
  id: string;
  status: string;
  customer_id: string;
  customer_name: string;
  customer_phone: string | null;
  customer_photo: string | null;
  plan_name: string;
  plan_price: number;
  plan_period: string;
  allowed_days: number[];
  included_uses: number;
  used_in_cycle: number;
  uses_left: number;
  is_expired: boolean;
  started_at: string;
  cancelled_at: string | null;
  current_period_start: string;
  current_period_end: string;
  notes: string | null;
}

interface PayoutRow {
  id: string;
  created_at: string;
  period_start: string;
  period_end: string;
  plan_price: number;
  share_percent: number;
  pool_amount: number;
  total_uses: number;
  customer_name: string;
  items: Array<{ staff_name: string; uses: number; amount: number }>;
}

interface CustomerOption {
  id: string;
  full_name: string;
  phone: string | null;
}

interface AssinaturasViewProps {
  plans: Plan[];
  subscriptions: SubscriptionRow[];
  payouts: PayoutRow[];
  customers: CustomerOption[];
}

const PERIOD_LABELS: Record<string, string> = {
  monthly: 'Mensal',
  quarterly: 'Trimestral',
  semiannual: 'Semestral',
  annual: 'Anual',
};

const PAYMENT_OPTIONS = [
  { value: 'pix', label: 'PIX', icon: Smartphone },
  { value: 'cash', label: 'Dinheiro', icon: Banknote },
  { value: 'credit', label: 'Crédito', icon: CreditCard },
  { value: 'debit', label: 'Débito', icon: CreditCard },
];

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR');
}

// ---------------------------------------------------------------------------

export function AssinaturasView({
  plans,
  subscriptions,
  payouts,
  customers,
}: AssinaturasViewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [tab, setTab] = useState<'planos' | 'assinantes' | 'repasses'>(
    'assinantes'
  );

  // Modal nova assinatura
  const [showNew, setShowNew] = useState(false);
  const [newForm, setNewForm] = useState({
    customer_id: '',
    plan_id: plans.find((p) => p.active)?.id ?? '',
    payment_method: 'pix',
    charge_now: true,
  });
  const [saving, setSaving] = useState(false);

  // Modal lancar pagamento (fechamento de ciclo)
  const [settleSub, setSettleSub] = useState<SubscriptionRow | null>(null);
  const [preview, setPreview] = useState<SettlementPreview | null>(null);
  const [settleMethod, setSettleMethod] = useState('pix');
  const [settling, setSettling] = useState(false);

  const activePlans = plans.filter((p) => p.active);

  const confirmDialog = useConfirm();

  // Busca, filtro e paginacao da lista de assinantes
  const [subQuery, setSubQuery] = useState('');
  const [subStatusFilter, setSubStatusFilter] = useState('all');
  const [subPage, setSubPage] = useState(1);
  const [subPageSize, setSubPageSize] = useState(5);

  const filteredSubs = useMemo(() => {
    const term = subQuery.trim().toLowerCase();
    return subscriptions.filter((sub) => {
      const matchQ = !term || sub.customer_name.toLowerCase().includes(term);
      const matchStatus =
        subStatusFilter === 'all' || sub.status === subStatusFilter;
      return matchQ && matchStatus;
    });
  }, [subscriptions, subQuery, subStatusFilter]);

  const subTotalPages = Math.max(1, Math.ceil(filteredSubs.length / subPageSize));
  const subSafePage = Math.min(subPage, subTotalPages);
  const pagedSubs = filteredSubs.slice(
    (subSafePage - 1) * subPageSize,
    subSafePage * subPageSize
  );

  useEffect(() => {
    setSubPage(1);
  }, [subQuery, subStatusFilter, subPageSize]);

  async function openSettle(sub: SubscriptionRow) {
    setSettleSub(sub);
    setPreview(null);
    setSettleMethod('pix');
    const p = await previewSettlement(sub.id);
    setPreview(p);
  }

  async function handleCreateSubscription() {
    if (!newForm.customer_id || !newForm.plan_id) {
      toast.error('Selecione cliente e plano');
      return;
    }
    setSaving(true);
    const result = await createSubscription({
      customer_id: newForm.customer_id,
      plan_id: newForm.plan_id,
      charge_now: newForm.charge_now,
      payment_method: newForm.payment_method,
    });
    setSaving(false);

    if (result.ok) {
      toast.success('Assinatura criada!');
      setShowNew(false);
      setNewForm({
        customer_id: '',
        plan_id: activePlans[0]?.id ?? '',
        payment_method: 'pix',
        charge_now: true,
      });
      startTransition(() => router.refresh());
    } else {
      toast.error(result.error ?? 'Erro ao criar assinatura');
    }
  }

  async function handleSettle() {
    if (!settleSub) return;
    setSettling(true);
    const result = await registerSubscriptionPayment(settleSub.id, settleMethod);
    setSettling(false);

    if (result.ok) {
      const parts =
        (result.payout ?? []).length > 0
          ? (result.payout ?? [])
              .map((p) => `${p.staff_name} ${formatCurrency(p.amount)}`)
              .join(' · ')
          : 'sem visitas no ciclo (valor fica pra barbearia)';
      toast.success(`Pagamento lançado! Repasse: ${parts}`);
      setSettleSub(null);
      setPreview(null);
      startTransition(() => router.refresh());
    } else {
      toast.error(result.error ?? 'Erro ao lançar pagamento');
    }
  }

  async function handleCancel(sub: SubscriptionRow) {
    if (!(await confirmDialog({ title: `Cancelar a assinatura de ${sub.customer_name}?`, danger: true }))) return;
    const result = await cancelSubscription(sub.id);
    if (result.ok) {
      toast.success('Assinatura cancelada');
      startTransition(() => router.refresh());
    } else toast.error(result.error ?? 'Erro');
  }

  async function handleReactivate(sub: SubscriptionRow) {
    const result = await reactivateSubscription(sub.id);
    if (result.ok) {
      toast.success('Assinatura reativada');
      startTransition(() => router.refresh());
    } else toast.error(result.error ?? 'Erro');
  }

  async function handleDeletePlan(plan: Plan) {
    if (!(await confirmDialog({ title: `Desativar o plano ${plan.name}?`, danger: true }))) return;
    const result = await deletePlan(plan.id);
    if (result.ok) {
      toast.success('Plano desativado');
      startTransition(() => router.refresh());
    } else toast.error(result.error ?? 'Erro');
  }

  function statusBadge(sub: SubscriptionRow) {
    if (sub.status === 'cancelled')
      return (
        <span className="px-2 py-0.5 rounded-full text-[9px] uppercase tracking-wider font-semibold bg-fg-dim/10 text-fg-subtle border border-border-strong">
          Cancelada
        </span>
      );
    if (sub.status === 'paused')
      return (
        <span className="px-2 py-0.5 rounded-full text-[9px] uppercase tracking-wider font-semibold bg-info/10 text-info border border-info/30">
          Pausada
        </span>
      );
    if (sub.is_expired)
      return (
        <span className="px-2 py-0.5 rounded-full text-[9px] uppercase tracking-wider font-semibold bg-danger/10 text-danger border border-danger/30">
          Vencida
        </span>
      );
    return (
      <span className="px-2 py-0.5 rounded-full text-[9px] uppercase tracking-wider font-semibold bg-success/10 text-success border border-success/30">
        Ativa
      </span>
    );
  }

  return (
    <div className="space-y-4">
      {/* TABS */}
      <div className="flex items-center gap-2 flex-wrap">
        {(
          [
            { v: 'assinantes', label: 'Assinantes', icon: Users },
            { v: 'planos', label: 'Planos', icon: Crown },
            { v: 'repasses', label: 'Repasses', icon: Wallet },
          ] as const
        ).map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.v}
              type="button"
              onClick={() => setTab(t.v)}
              className={cn(
                'px-4 py-2 rounded-md text-xs font-medium transition-all flex items-center gap-2',
                tab === t.v
                  ? 'bg-gold text-bg shadow-gold'
                  : 'bg-bg-elevated text-fg-muted hover:text-fg border border-border'
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          );
        })}

        {tab === 'assinantes' && (
          <button
            type="button"
            onClick={() => setShowNew(true)}
            className="ml-auto btn-gold-outline text-xs flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nova assinatura</span>
          </button>
        )}
      </div>

      {/* ===================== TAB ASSINANTES ===================== */}
      {tab === 'assinantes' && (
        <div className="space-y-3">
          {/* CONTROLES: busca, status e tamanho da pagina */}
          <div className="card p-3 flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-subtle" />
              <input
                type="text"
                placeholder="Buscar assinante por nome..."
                className="input pl-10 py-1.5 text-sm w-full"
                value={subQuery}
                onChange={(e) => setSubQuery(e.target.value)}
              />
            </div>
            <select
              className="input py-1.5 text-xs w-auto"
              value={subStatusFilter}
              onChange={(e) => setSubStatusFilter(e.target.value)}
            >
              <option value="all">Todos os status</option>
              <option value="active">Ativas</option>
              <option value="past_due">Inadimplentes</option>
              <option value="cancelled">Canceladas</option>
            </select>
            <select
              className="input py-1.5 text-xs w-auto"
              value={subPageSize}
              onChange={(e) => setSubPageSize(Number(e.target.value))}
              title="Assinaturas por página"
            >
              <option value={5}>5 por página</option>
              <option value={10}>10 por página</option>
              <option value={20}>20 por página</option>
            </select>
          </div>
          {subscriptions.length === 0 ? (
            <div className="card p-12 text-center">
              <Crown className="w-8 h-8 text-gold mx-auto mb-3" />
              <h3
                className="text-lg font-bold text-fg mb-1"
                style={{ fontFamily: 'var(--font-playfair), serif' }}
              >
                Nenhum assinante ainda
              </h3>
              <p className="text-sm text-fg-muted mb-4">
                Crie um plano e assine o primeiro cliente do clube.
              </p>
              <button
                type="button"
                onClick={() => setShowNew(true)}
                className="btn-gold-shimmer inline-flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>Nova assinatura</span>
              </button>
            </div>
          ) : (
            pagedSubs.map((sub) => {
              const pct =
                sub.included_uses > 0
                  ? Math.min(100, (sub.used_in_cycle / sub.included_uses) * 100)
                  : 0;
              const initials = sub.customer_name
                .split(' ')
                .map((n) => n[0])
                .join('')
                .slice(0, 2)
                .toUpperCase();
              const isActive = ['active', 'past_due'].includes(sub.status);

              return (
                <div key={sub.id} className="card p-5">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-3 min-w-0">
                      {sub.customer_photo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={sub.customer_photo}
                          alt={sub.customer_name}
                          className="w-11 h-11 rounded-full object-cover border-2 border-gold/30 flex-shrink-0"
                        />
                      ) : (
                        <div
                          className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold text-bg flex-shrink-0"
                          style={{
                            background:
                              'linear-gradient(135deg, #D4A04F 0%, #F5C518 100%)',
                          }}
                        >
                          {initials}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3
                            className="text-base font-bold text-fg truncate"
                            style={{ fontFamily: 'var(--font-playfair), serif' }}
                          >
                            {sub.customer_name}
                          </h3>
                          {statusBadge(sub)}
                        </div>
                        <p className="text-[11px] text-fg-muted mt-0.5">
                          {sub.plan_name} · {formatCurrency(sub.plan_price)}{' '}
                          {PERIOD_LABELS[sub.plan_period] ?? sub.plan_period} ·{' '}
                          <span className="text-gold">
                            {formatAllowedDays(sub.allowed_days)}
                          </span>
                        </p>
                      </div>
                    </div>

                    {isActive && (
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => openSettle(sub)}
                          className={cn(
                            'text-xs flex items-center gap-1.5',
                            sub.is_expired ? 'btn-gold-shimmer' : 'btn-gold-outline'
                          )}
                        >
                          <Wallet className="w-3.5 h-3.5" />
                          <span>Lançar pagamento</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCancel(sub)}
                          className="p-2 rounded-md text-fg-subtle hover:text-danger hover:bg-danger/10 transition-colors"
                          title="Cancelar assinatura"
                        >
                          <Ban className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                    {sub.status === 'cancelled' && (
                      <button
                        type="button"
                        onClick={() => handleReactivate(sub)}
                        className="btn-secondary text-xs flex items-center gap-1.5"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Reativar</span>
                      </button>
                    )}
                  </div>

                  {isActive && (
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                      <div className="md:col-span-2">
                        <div className="flex items-center justify-between text-[11px] mb-1.5">
                          <span className="text-fg-muted flex items-center gap-1.5">
                            <Scissors className="w-3 h-3 text-gold" />
                            Usos no ciclo
                          </span>
                          <span className="text-fg font-semibold">
                            {sub.used_in_cycle} de {sub.included_uses}
                            {sub.uses_left > 0 && (
                              <span className="text-fg-subtle font-normal">
                                {' '}
                                · restam {sub.uses_left}
                              </span>
                            )}
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-bg-elevated border border-border overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${pct}%`,
                              background:
                                'linear-gradient(90deg, #D4A04F 0%, #F5C518 100%)',
                            }}
                          />
                        </div>
                      </div>
                      <div
                        className={cn(
                          'text-[11px] flex items-center gap-1.5 md:justify-end',
                          sub.is_expired ? 'text-danger' : 'text-fg-muted'
                        )}
                      >
                        <Calendar className="w-3 h-3" />
                        {sub.is_expired ? 'Venceu em ' : 'Vence em '}
                        <span className="font-semibold">
                          {fmtDate(sub.current_period_end)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}

          {filteredSubs.length === 0 && subscriptions.length > 0 && (
            <div className="card p-8 text-center">
              <p className="text-sm text-fg-muted">
                Nenhuma assinatura encontrada com os filtros atuais.
              </p>
            </div>
          )}

          {subTotalPages > 1 && (
            <div className="card px-4 py-3 flex items-center justify-between">
              <button
                type="button"
                disabled={subSafePage <= 1}
                onClick={() => setSubPage(subSafePage - 1)}
                className="btn-ghost text-xs flex items-center gap-1 disabled:opacity-40"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Anterior
              </button>
              <p className="text-xs text-fg-muted">
                Página {subSafePage} de {subTotalPages} · {filteredSubs.length} assinaturas
              </p>
              <button
                type="button"
                disabled={subSafePage >= subTotalPages}
                onClick={() => setSubPage(subSafePage + 1)}
                className="btn-ghost text-xs flex items-center gap-1 disabled:opacity-40"
              >
                Próxima
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* ===================== TAB PLANOS ===================== */}
      {tab === 'planos' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {plans.length === 0 ? (
            <div className="card p-12 text-center md:col-span-2 lg:col-span-3">
              <Crown className="w-8 h-8 text-gold mx-auto mb-3" />
              <p className="text-sm text-fg-muted">
                Nenhum plano criado.{' '}
                <Link
                  href="/admin/assinaturas/planos/novo"
                  className="text-gold hover:underline"
                >
                  Criar primeiro plano
                </Link>
              </p>
            </div>
          ) : (
            plans.map((plan) => (
              <div
                key={plan.id}
                className={cn('card-premium p-5 flex flex-col', !plan.active && 'opacity-50')}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3
                    className="text-lg font-bold text-fg"
                    style={{ fontFamily: 'var(--font-playfair), serif' }}
                  >
                    {plan.name}
                  </h3>
                  <Star className="w-4 h-4 text-gold fill-current flex-shrink-0" />
                </div>

                <p
                  className="text-2xl font-bold text-gold leading-none mb-1"
                  style={{ fontFamily: 'var(--font-playfair), serif' }}
                >
                  {formatCurrency(plan.price)}
                  <span className="text-[11px] text-fg-subtle font-normal ml-1.5">
                    / {(PERIOD_LABELS[plan.period] ?? plan.period).toLowerCase()}
                  </span>
                </p>

                {plan.description && (
                  <p className="text-xs text-fg-muted mb-3 leading-relaxed">
                    {plan.description}
                  </p>
                )}

                <div className="space-y-1.5 text-[11px] text-fg-muted mt-auto">
                  <p className="flex items-center gap-1.5">
                    <Scissors className="w-3 h-3 text-gold" />
                    {plan.included_uses} atendimentos por ciclo
                  </p>
                  <p className="flex items-center gap-1.5">
                    <Calendar className="w-3 h-3 text-gold" />
                    {formatAllowedDays(plan.allowed_days)}
                  </p>
                  <p className="flex items-center gap-1.5">
                    <Wallet className="w-3 h-3 text-gold" />
                    Potinho dos barbeiros: {plan.barber_share_percent}% (
                    {formatCurrency((plan.price * plan.barber_share_percent) / 100)})
                  </p>
                </div>

                <div className="flex items-center gap-2 mt-4 pt-3 border-t border-border/60">
                  <Link
                    href={`/admin/assinaturas/planos/${plan.id}`}
                    className="btn-secondary text-xs flex items-center gap-1.5 flex-1 justify-center"
                  >
                    <Pencil className="w-3 h-3" />
                    <span>Editar</span>
                  </Link>
                  {plan.active && (
                    <button
                      type="button"
                      onClick={() => handleDeletePlan(plan)}
                      className="p-2 rounded-md text-fg-subtle hover:text-danger hover:bg-danger/10 transition-colors"
                      title="Desativar plano"
                    >
                      <Ban className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ===================== TAB REPASSES ===================== */}
      {tab === 'repasses' && (
        <div className="space-y-3">
          {payouts.length === 0 ? (
            <div className="card p-12 text-center">
              <Wallet className="w-8 h-8 text-gold mx-auto mb-3" />
              <p className="text-sm text-fg-muted max-w-md mx-auto">
                Nenhum repasse ainda. O potinho de cada assinatura é fechado e
                dividido entre os barbeiros no momento em que você lança o
                pagamento da renovação.
              </p>
            </div>
          ) : (
            payouts.map((p) => (
              <div key={p.id} className="card p-5">
                <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
                  <div>
                    <p
                      className="text-base font-bold text-fg"
                      style={{ fontFamily: 'var(--font-playfair), serif' }}
                    >
                      {p.customer_name}
                    </p>
                    <p className="text-[11px] text-fg-muted">
                      Ciclo {fmtDate(p.period_start)} a {fmtDate(p.period_end)} ·
                      fechado em {fmtDate(p.created_at)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] uppercase tracking-wider text-fg-dim">
                      Potinho ({p.share_percent}%)
                    </p>
                    <p
                      className="text-xl font-bold text-gold"
                      style={{ fontFamily: 'var(--font-playfair), serif' }}
                    >
                      {formatCurrency(p.pool_amount)}
                    </p>
                  </div>
                </div>

                {p.items.length === 0 ? (
                  <p className="text-xs text-fg-subtle bg-bg-elevated rounded-md p-3">
                    Sem visitas no ciclo: valor integral ficou como receita da
                    barbearia.
                  </p>
                ) : (
                  <div className="space-y-1">
                    {p.items.map((item, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between text-xs p-2 rounded-md bg-bg-elevated"
                      >
                        <span className="text-fg">
                          {item.staff_name}{' '}
                          <span className="text-fg-subtle">
                            · {item.uses} atendimento{item.uses === 1 ? '' : 's'}
                          </span>
                        </span>
                        <span className="font-bold text-gold">
                          {formatCurrency(item.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* ===================== MODAL NOVA ASSINATURA ===================== */}
      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="card-premium p-6 w-full max-w-md space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3
                className="text-lg font-bold text-fg"
                style={{ fontFamily: 'var(--font-playfair), serif' }}
              >
                Nova assinatura
              </h3>
              <button
                type="button"
                onClick={() => setShowNew(false)}
                className="text-fg-subtle hover:text-fg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="label">Cliente</label>
              <select
                className="input"
                value={newForm.customer_id}
                onChange={(e) =>
                  setNewForm({ ...newForm, customer_id: e.target.value })
                }
              >
                <option value="">Selecione...</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.full_name}
                    {c.phone ? ` · ${formatPhone(c.phone)}` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Plano</label>
              <select
                className="input"
                value={newForm.plan_id}
                onChange={(e) =>
                  setNewForm({ ...newForm, plan_id: e.target.value })
                }
              >
                <option value="">Selecione...</option>
                {activePlans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {formatCurrency(p.price)} ·{' '}
                    {p.included_uses} usos · {formatAllowedDays(p.allowed_days)}
                  </option>
                ))}
              </select>
            </div>

            <label className="flex items-start gap-3 p-3 rounded-md bg-bg-elevated border border-border cursor-pointer hover:border-gold/30 transition-colors">
              <input
                type="checkbox"
                className="w-4 h-4 accent-gold mt-0.5 cursor-pointer"
                checked={newForm.charge_now}
                onChange={(e) =>
                  setNewForm({ ...newForm, charge_now: e.target.checked })
                }
              />
              <div>
                <p className="text-sm text-fg font-medium">
                  Lançar 1º pagamento agora
                </p>
                <p className="text-[11px] text-fg-subtle">
                  Registra a receita e inicia o ciclo hoje.
                </p>
              </div>
            </label>

            {newForm.charge_now && (
              <div>
                <p className="label mb-2">Forma de pagamento</p>
                <div className="grid grid-cols-2 gap-2">
                  {PAYMENT_OPTIONS.map((p) => {
                    const Icon = p.icon;
                    const selected = newForm.payment_method === p.value;
                    return (
                      <button
                        key={p.value}
                        type="button"
                        onClick={() =>
                          setNewForm({ ...newForm, payment_method: p.value })
                        }
                        className={cn(
                          'p-2.5 rounded-md border text-xs flex items-center gap-2 transition-all',
                          selected
                            ? 'border-gold/40 bg-gold/10 text-gold'
                            : 'border-border text-fg-muted hover:border-gold/20'
                        )}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span>{p.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={handleCreateSubscription}
              disabled={saving}
              className="btn-gold-shimmer w-full flex items-center justify-center gap-2"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              <span>Criar assinatura</span>
            </button>
          </div>
        </div>
      )}

      {/* ===================== MODAL LANÇAR PAGAMENTO ===================== */}
      {settleSub && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="card-premium p-6 w-full max-w-md space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3
                className="text-lg font-bold text-fg"
                style={{ fontFamily: 'var(--font-playfair), serif' }}
              >
                Lançar pagamento
              </h3>
              <button
                type="button"
                onClick={() => {
                  setSettleSub(null);
                  setPreview(null);
                }}
                className="text-fg-subtle hover:text-fg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {!preview ? (
              <div className="py-8 flex items-center justify-center gap-2 text-fg-muted text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Calculando rateio...</span>
              </div>
            ) : !preview.ok ? (
              <p className="text-sm text-danger">{preview.error}</p>
            ) : (
              <>
                <div className="text-sm text-fg-muted">
                  <span className="text-fg font-semibold">
                    {preview.customerName}
                  </span>{' '}
                  · {preview.planName} ·{' '}
                  <span className="text-gold font-semibold">
                    {formatCurrency(preview.price ?? 0)}
                  </span>
                </div>

                {/* Fechamento do ciclo anterior */}
                <div className="card p-4 space-y-2 bg-bg-elevated">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="uppercase tracking-wider text-fg-dim">
                      Fechamento do ciclo
                    </span>
                    <span className="text-fg-muted">
                      {preview.totalUses} uso{preview.totalUses === 1 ? '' : 's'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-fg-muted">
                      Potinho dos barbeiros ({preview.sharePercent}%)
                    </span>
                    <span className="text-base font-bold text-gold">
                      {formatCurrency(preview.poolAmount ?? 0)}
                    </span>
                  </div>

                  {(preview.items ?? []).length === 0 ? (
                    <p className="text-[11px] text-fg-subtle pt-1 border-t border-border/60">
                      Sem visitas neste ciclo: o valor fica integral como
                      receita da barbearia.
                    </p>
                  ) : (
                    <div className="space-y-1 pt-1 border-t border-border/60">
                      {(preview.items ?? []).map((item) => (
                        <div
                          key={item.staff_id}
                          className="flex items-center justify-between text-xs"
                        >
                          <span className="text-fg">
                            {item.staff_name}{' '}
                            <span className="text-fg-subtle">
                              · {item.uses}x
                            </span>
                          </span>
                          <span className="font-semibold text-gold">
                            {formatCurrency(item.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 text-[11px] text-fg-muted">
                  <AlertTriangle className="w-3.5 h-3.5 text-gold flex-shrink-0" />
                  <span>
                    Novo ciclo: usos zeram e a assinatura vale até{' '}
                    <span className="text-fg font-semibold">
                      {preview.newPeriodEnd ? fmtDate(preview.newPeriodEnd) : '-'}
                    </span>
                    .
                  </span>
                </div>

                <div>
                  <p className="label mb-2">Forma de pagamento</p>
                  <div className="grid grid-cols-2 gap-2">
                    {PAYMENT_OPTIONS.map((p) => {
                      const Icon = p.icon;
                      const selected = settleMethod === p.value;
                      return (
                        <button
                          key={p.value}
                          type="button"
                          onClick={() => setSettleMethod(p.value)}
                          className={cn(
                            'p-2.5 rounded-md border text-xs flex items-center gap-2 transition-all',
                            selected
                              ? 'border-gold/40 bg-gold/10 text-gold'
                              : 'border-border text-fg-muted hover:border-gold/20'
                          )}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          <span>{p.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSettle}
                  disabled={settling || isPending}
                  className="btn-gold-shimmer w-full flex items-center justify-center gap-2"
                >
                  {settling ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  <span>
                    Confirmar pagamento de {formatCurrency(preview.price ?? 0)}
                  </span>
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
