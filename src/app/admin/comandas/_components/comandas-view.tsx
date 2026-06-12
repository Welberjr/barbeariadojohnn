'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Plus,
  Receipt,
  ClipboardList,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  X,
  ArrowRight,
  Clock,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn, formatCurrency, formatPhone } from '@/lib/utils';
import { createComanda } from '../actions';

interface Customer {
  id: string;
  full_name: string;
  phone: string | null;
}

interface Staff {
  id: string;
  display_name: string;
  role: string;
}

interface OpenComanda {
  id: string;
  customer_id: string;
  staff_id: string;
  total: number;
  subtotal: number;
  service_total: number;
  product_total: number;
  opened_at: string;
  customers: { full_name: string; phone: string | null } | null;
  staff: { display_name: string } | null;
}

interface ClosedComanda {
  id: string;
  customer_id: string;
  total: number;
  payment_method: string | null;
  closed_at: string;
  customers: { full_name: string } | null;
  staff: { display_name: string } | null;
}

interface ClosedFilter {
  mode: 'hoje' | 'todas' | 'data';
  date: string | null;
  page: number;
  totalPages: number;
  totalCount: number;
}

interface ComandasViewProps {
  openComandas: OpenComanda[];
  closedList: ClosedComanda[];
  statsToday: { count: number; total: number };
  closedFilter: ClosedFilter;
  customers: Customer[];
  staff: Staff[];
}

export function ComandasView({
  openComandas,
  closedList,
  statsToday,
  closedFilter,
  customers,
  staff,
}: ComandasViewProps) {
  const router = useRouter();
  const [isPending] = useTransition();
  const [showNew, setShowNew] = useState(false);
  const [newForm, setNewForm] = useState({
    customer_id: '',
    staff_id: staff[0]?.id ?? '',
  });
  const [customerSearch, setCustomerSearch] = useState('');

  async function handleNewComanda() {
    if (!newForm.customer_id || !newForm.staff_id) {
      toast.error('Selecione cliente e profissional');
      return;
    }

    const result = await createComanda({
      customer_id: newForm.customer_id,
      staff_id: newForm.staff_id,
    });

    if (result.ok && result.comanda) {
      toast.success('Comanda aberta!');
      setShowNew(false);
      // Redirecionar pra detalhe da comanda
      router.push(`/admin/comandas/${result.comanda.id}`);
    } else {
      toast.error(result.error ?? 'Erro');
    }
  }

  // Estatísticas do dia
  const totalOpen = openComandas.reduce((sum, c) => sum + Number(c.total), 0);
  const STALE_MIN = 240; // 4 horas
  const staleCount = openComandas.filter(
    (c) => (Date.now() - new Date(c.opened_at).getTime()) / 60000 > STALE_MIN
  ).length;

  // Filtrar clientes na busca
  const filteredCustomers = customerSearch.trim()
    ? customers
        .filter(
          (c) =>
            c.full_name.toLowerCase().includes(customerSearch.toLowerCase()) ||
            (c.phone && c.phone.includes(customerSearch))
        )
        .slice(0, 20)
    : customers.slice(0, 20);

  const selectedCustomer = customers.find((c) => c.id === newForm.customer_id);

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <p className="text-[10px] text-gold tracking-[0.3em] uppercase font-semibold mb-1">
            Gestão
          </p>
          <h1
            className="text-2xl md:text-3xl font-bold text-fg"
            style={{ fontFamily: 'var(--font-playfair), serif' }}
          >
            Comandas
          </h1>
          <p className="text-sm text-fg-muted mt-1">
            Atendimentos em curso e vendas do dia.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowNew(true)}
          className="btn-primary flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          <span>Abrir comanda</span>
        </button>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card-premium p-4">
          <div className="flex items-center gap-2 mb-1">
            <ClipboardList className="w-3.5 h-3.5 text-gold" />
            <p className="text-[10px] text-fg-dim tracking-widest uppercase">
              Abertas
            </p>
          </div>
          <p
            className="text-2xl font-bold text-fg"
            style={{ fontFamily: 'var(--font-playfair), serif' }}
          >
            {openComandas.length}
          </p>
        </div>
        <div className="card-premium p-4">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-3.5 h-3.5 text-gold-shimmer" />
            <p className="text-[10px] text-fg-dim tracking-widest uppercase">
              Em curso
            </p>
          </div>
          <p
            className="text-2xl font-bold text-gold-shimmer"
            style={{ fontFamily: 'var(--font-playfair), serif' }}
          >
            {formatCurrency(totalOpen)}
          </p>
        </div>
        <div className="card-premium p-4">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-success" />
            <p className="text-[10px] text-fg-dim tracking-widest uppercase">
              Fechadas hoje
            </p>
          </div>
          <p
            className="text-2xl font-bold text-success"
            style={{ fontFamily: 'var(--font-playfair), serif' }}
          >
            {statsToday.count}
          </p>
        </div>
        <div className="card-premium p-4">
          <div className="flex items-center gap-2 mb-1">
            <Receipt className="w-3.5 h-3.5 text-gold" />
            <p className="text-[10px] text-fg-dim tracking-widest uppercase">
              Faturado hoje
            </p>
          </div>
          <p
            className="text-2xl font-bold text-gold"
            style={{ fontFamily: 'var(--font-playfair), serif' }}
          >
            {formatCurrency(statsToday.total)}
          </p>
        </div>
      </div>

      {/* COMANDAS ABERTAS */}
      <section className="card p-6">
        <h2
          className="text-lg font-semibold text-fg mb-4 flex items-center gap-2"
          style={{ fontFamily: 'var(--font-playfair), serif' }}
        >
          <ClipboardList className="w-5 h-5 text-gold" />
          Em curso ({openComandas.length})
        </h2>

        {staleCount > 0 && (
          <div className="mb-4 flex items-start gap-2.5 p-3 rounded-md border border-danger/40 bg-danger/10">
            <AlertTriangle className="w-4 h-4 text-danger flex-shrink-0 mt-0.5" />
            <p className="text-xs text-danger">
              <span className="font-semibold">
                {staleCount} {staleCount === 1 ? 'comanda aberta' : 'comandas abertas'} há mais de 4 horas.
              </span>{' '}
              Revise se o atendimento já foi concluído e feche a comanda.
            </p>
          </div>
        )}

        {openComandas.length === 0 ? (
          <div className="text-center py-12 text-fg-subtle">
            <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Nenhuma comanda aberta</p>
            <p className="text-xs mt-1 text-fg-dim">
              Clique em &quot;Abrir comanda&quot; para começar um atendimento.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {openComandas.map((c) => {
              const openedAt = new Date(c.opened_at);
              const elapsed = Math.floor(
                (Date.now() - openedAt.getTime()) / 60000
              );
              const openedTime = openedAt.toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit',
              });
              const isStale = elapsed > STALE_MIN;
              const elapsedLabel =
                elapsed < 60
                  ? `${elapsed} min`
                  : `${Math.floor(elapsed / 60)}h${
                      elapsed % 60 > 0 ? String(elapsed % 60).padStart(2, '0') : ''
                    }`;

              return (
                <Link
                  key={c.id}
                  href={`/admin/comandas/${c.id}`}
                  className={cn(
                    'card-premium p-4 transition-all group',
                    isStale
                      ? 'border-danger/50 hover:border-danger'
                      : 'hover:border-gold/40'
                  )}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold text-bg flex-shrink-0"
                      style={{
                        background:
                          'linear-gradient(135deg, #D4A04F 0%, #F5C518 100%)',
                      }}
                    >
                      {(c.customers?.full_name ?? '?')
                        .trim()
                        .split(/\s+/)
                        .map((n) => n[0] ?? '')
                        .join('')
                        .slice(0, 2)
                        .toUpperCase() || '?'}
                    </div>

                    <div className="text-right">
                      <p
                        className={cn(
                          'text-[10px] uppercase tracking-wider flex items-center justify-end gap-1',
                          isStale ? 'text-danger font-semibold' : 'text-fg-dim'
                        )}
                      >
                        {isStale && <AlertTriangle className="w-3 h-3" />}
                        {elapsedLabel}
                      </p>
                      <p className="text-[10px] text-fg-subtle font-mono">
                        {openedTime}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-fg truncate">
                      {c.customers?.full_name ?? 'Cliente'}
                    </p>
                    <p className="text-[11px] text-fg-muted truncate">
                      {c.staff?.display_name ?? 'Sem profissional'}
                    </p>
                  </div>

                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/40">
                    <p className="text-[10px] uppercase tracking-wider text-fg-dim">
                      Total
                    </p>
                    <p
                      className="text-lg font-bold text-gold"
                      style={{ fontFamily: 'var(--font-playfair), serif' }}
                    >
                      {formatCurrency(Number(c.total ?? 0))}
                    </p>
                  </div>

                  <div className="mt-2 flex items-center gap-1 text-[10px] text-gold opacity-0 group-hover:opacity-100 transition-opacity">
                    <span>Abrir detalhes</span>
                    <ArrowRight className="w-3 h-3" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* FECHADAS */}
      <section className="card p-6">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <h2
            className="text-lg font-semibold text-fg flex items-center gap-2"
            style={{ fontFamily: 'var(--font-playfair), serif' }}
          >
            <CheckCircle2 className="w-5 h-5 text-success" />
            {closedFilter.mode === 'hoje' &&
              `Fechadas hoje (${closedList.length})`}
            {closedFilter.mode === 'data' &&
              `Fechadas em ${(closedFilter.date ?? '').split('-').reverse().join('/')} (${closedList.length})`}
            {closedFilter.mode === 'todas' &&
              `Todas as fechadas (${closedFilter.totalCount})`}
          </h2>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => router.push('/admin/comandas')}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs border transition-colors',
                closedFilter.mode === 'hoje'
                  ? 'border-gold bg-gold/15 text-gold font-semibold'
                  : 'border-border text-fg-muted hover:border-gold/40'
              )}
            >
              Hoje
            </button>
            <button
              type="button"
              onClick={() => router.push('/admin/comandas?periodo=todas')}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs border transition-colors',
                closedFilter.mode === 'todas'
                  ? 'border-gold bg-gold/15 text-gold font-semibold'
                  : 'border-border text-fg-muted hover:border-gold/40'
              )}
            >
              Todas
            </button>
            <input
              type="date"
              className={cn(
                'input text-xs py-1.5 w-auto',
                closedFilter.mode === 'data' && 'border-gold'
              )}
              value={closedFilter.date ?? ''}
              onChange={(e) =>
                e.target.value
                  ? router.push(`/admin/comandas?data=${e.target.value}`)
                  : router.push('/admin/comandas')
              }
            />
          </div>
        </div>

        {closedList.length === 0 ? (
          <p className="text-center text-fg-subtle text-sm py-8">
            Nenhuma comanda fechada neste período
          </p>
        ) : (
          <div className="space-y-1">
            {closedList.map((c) => {
              const closedAt = new Date(c.closed_at);
              const closedTime = closedAt.toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit',
              });
              const closedDate = closedAt.toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
              });
              const paymentLabels: Record<string, string> = {
                cash: 'Dinheiro',
                pix: 'PIX',
                debit: 'Débito',
                credit: 'Crédito',
                credit_parcel: 'Crédito parcelado',
                mixed: 'Misto',
              };

              return (
                <Link
                  key={c.id}
                  href={`/admin/comandas/${c.id}`}
                  className="flex items-center gap-3 p-3 rounded-md border border-border/40 hover:bg-bg-elevated hover:border-gold/40 transition-colors group"
                >
                  <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-fg truncate">
                      {c.customers?.full_name ?? 'Cliente'}
                    </p>
                    <p className="text-[11px] text-fg-muted">
                      {c.staff?.display_name ?? '-'} ·{' '}
                      {closedFilter.mode === 'hoje'
                        ? closedTime
                        : `${closedDate} ${closedTime}`}
                      {c.payment_method && (
                        <span className="ml-2 text-fg-subtle">
                          · {paymentLabels[c.payment_method] ?? c.payment_method}
                        </span>
                      )}
                    </p>
                  </div>
                  <p className="text-sm font-bold text-gold flex-shrink-0">
                    {formatCurrency(Number(c.total))}
                  </p>
                  <ArrowRight className="w-3.5 h-3.5 text-gold opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                </Link>
              );
            })}
          </div>
        )}

        {closedFilter.mode === 'todas' && closedFilter.totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/40">
            <button
              type="button"
              disabled={closedFilter.page <= 1}
              onClick={() =>
                router.push(
                  `/admin/comandas?periodo=todas&pagina=${closedFilter.page - 1}`
                )
              }
              className="btn-ghost text-xs flex items-center gap-1 disabled:opacity-40"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Anterior
            </button>
            <p className="text-xs text-fg-muted">
              Página {closedFilter.page} de {closedFilter.totalPages}
            </p>
            <button
              type="button"
              disabled={closedFilter.page >= closedFilter.totalPages}
              onClick={() =>
                router.push(
                  `/admin/comandas?periodo=todas&pagina=${closedFilter.page + 1}`
                )
              }
              className="btn-ghost text-xs flex items-center gap-1 disabled:opacity-40"
            >
              Próxima
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </section>
      {/* DRAWER NOVA COMANDA */}
      {showNew && (
        <>
          <div
            className="fixed inset-0 bg-black/60 z-40 animate-fade-in"
            onClick={() => setShowNew(false)}
          />
          <div className="fixed inset-y-0 right-0 w-full max-w-md bg-bg border-l border-border z-50 shadow-2xl overflow-y-auto animate-slide-in-right">
            <div className="sticky top-0 bg-bg border-b border-border p-5 flex items-center justify-between z-10">
              <div>
                <p className="text-[10px] text-gold tracking-widest uppercase font-semibold">
                  Nova
                </p>
                <h2
                  className="text-lg font-bold text-fg"
                  style={{ fontFamily: 'var(--font-playfair), serif' }}
                >
                  Abrir Comanda
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowNew(false)}
                className="p-2 rounded-md hover:bg-bg-elevated text-fg-muted hover:text-fg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              {/* Cliente */}
              <div>
                <label className="label text-xs">Cliente *</label>
                {selectedCustomer ? (
                  <div className="flex items-center gap-2 p-3 rounded-md border border-gold/40 bg-gold/5">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-fg">
                        {selectedCustomer.full_name}
                      </p>
                      {selectedCustomer.phone && (
                        <p className="text-xs text-fg-muted">
                          {formatPhone(selectedCustomer.phone)}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setNewForm({ ...newForm, customer_id: '' })}
                      className="text-fg-subtle hover:text-fg text-xs"
                    >
                      Trocar
                    </button>
                  </div>
                ) : (
                  <>
                    <input
                      type="text"
                      placeholder="Buscar por nome ou telefone..."
                      className="input text-sm"
                      value={customerSearch}
                      onChange={(e) => setCustomerSearch(e.target.value)}
                      autoFocus
                    />
                    {customerSearch && (
                      <div className="mt-2 max-h-48 overflow-y-auto border border-border rounded-md">
                        {filteredCustomers.length === 0 ? (
                          <div className="p-3 text-center text-xs text-fg-subtle">
                            Nenhum cliente encontrado
                          </div>
                        ) : (
                          filteredCustomers.map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => {
                                setNewForm({ ...newForm, customer_id: c.id });
                                setCustomerSearch('');
                              }}
                              className="w-full text-left p-2.5 hover:bg-bg-elevated border-b border-border/40 last:border-b-0 transition-colors"
                            >
                              <p className="text-sm text-fg">{c.full_name}</p>
                              {c.phone && (
                                <p className="text-[11px] text-fg-muted">
                                  {formatPhone(c.phone)}
                                </p>
                              )}
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Profissional */}
              <div>
                <label className="label text-xs">Profissional *</label>
                <select
                  className="input text-sm"
                  value={newForm.staff_id}
                  onChange={(e) =>
                    setNewForm({ ...newForm, staff_id: e.target.value })
                  }
                >
                  <option value="">Selecione...</option>
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.display_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Ações */}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNew(false)}
                  className="btn-ghost flex-1 text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleNewComanda}
                  disabled={
                    isPending || !newForm.customer_id || !newForm.staff_id
                  }
                  className={cn(
                    'btn-primary flex-1 text-sm flex items-center justify-center gap-1.5'
                  )}
                >
                  {isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ArrowRight className="w-4 h-4" />
                  )}
                  <span>Abrir e ir para detalhes</span>
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
