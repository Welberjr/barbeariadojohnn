'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Crown,
  Users,
  Loader2,
  Plus,
  XCircle,
  RotateCcw,
  Repeat,
  Edit3,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import {
  createSubscription,
  cancelSubscription,
  reactivateSubscription,
  renewSubscription,
} from '../actions';

interface Plan {
  id: string;
  name: string;
  description: string | null;
  price: number;
  billing_cycle: string;
  includes_count: number;
  discount_percent_on_extras: number;
  active: boolean;
}

interface Subscription {
  id: string;
  customer_id: string;
  plan_id: string;
  status: string;
  started_at: string;
  current_period_end: string;
  remaining_uses: number;
  customer_name: string;
  customer_phone: string | null;
  plan_name: string;
  plan_price: number;
}

interface CustomerOpt {
  id: string;
  full_name: string;
  phone: string | null;
}

interface AssinaturasViewProps {
  plans: Plan[];
  subscriptions: Subscription[];
  customers: CustomerOpt[];
}

export function AssinaturasView({
  plans,
  subscriptions,
  customers,
}: AssinaturasViewProps) {
  const router = useRouter();
  const [tab, setTab] = useState<'planos' | 'assinantes'>('planos');
  const [showForm, setShowForm] = useState(false);
  const [formCustomerId, setFormCustomerId] = useState('');
  const [formPlanId, setFormPlanId] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [actioningId, setActioningId] = useState<string | null>(null);

  const activeSubs = subscriptions.filter((s) => s.status === 'active');
  const cancelledSubs = subscriptions.filter((s) => s.status !== 'active');

  async function handleCreate() {
    if (!formCustomerId || !formPlanId) {
      toast.error('Selecione cliente e plano.');
      return;
    }
    setIsSaving(true);
    const result = await createSubscription({
      customer_id: formCustomerId,
      plan_id: formPlanId,
      notes: formNotes || null,
    });
    if (result.ok) {
      toast.success('Assinatura criada!');
      setShowForm(false);
      setFormCustomerId('');
      setFormPlanId('');
      setFormNotes('');
      router.refresh();
    } else {
      toast.error(result.error ?? 'Erro ao criar.');
    }
    setIsSaving(false);
  }

  async function handleCancel(subId: string) {
    if (!confirm('Cancelar esta assinatura?')) return;
    setActioningId(subId);
    const result = await cancelSubscription(subId);
    if (result.ok) {
      toast.success('Assinatura cancelada.');
      router.refresh();
    } else {
      toast.error(result.error ?? 'Erro.');
    }
    setActioningId(null);
  }

  async function handleReactivate(subId: string) {
    setActioningId(subId);
    const result = await reactivateSubscription(subId);
    if (result.ok) {
      toast.success('Assinatura reativada!');
      router.refresh();
    } else {
      toast.error(result.error ?? 'Erro.');
    }
    setActioningId(null);
  }

  async function handleRenew(subId: string) {
    setActioningId(subId);
    const result = await renewSubscription(subId);
    if (result.ok) {
      toast.success('Assinatura renovada para o próximo ciclo!');
      router.refresh();
    } else {
      toast.error(result.error ?? 'Erro.');
    }
    setActioningId(null);
  }

  const cycleLabel = (c: string) => {
    const map: Record<string, string> = {
      monthly: 'Mensal',
      weekly: 'Semanal',
      yearly: 'Anual',
    };
    return map[c] ?? c;
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

  return (
    <div className="space-y-4">
      {/* TABS */}
      <div className="flex gap-1 border-b border-border">
        <button
          type="button"
          onClick={() => setTab('planos')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'planos'
              ? 'border-gold text-gold'
              : 'border-transparent text-fg-muted hover:text-fg'
          }`}
        >
          <Crown className="w-4 h-4 inline mr-1.5" />
          Planos ({plans.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('assinantes')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'assinantes'
              ? 'border-gold text-gold'
              : 'border-transparent text-fg-muted hover:text-fg'
          }`}
        >
          <Users className="w-4 h-4 inline mr-1.5" />
          Assinantes ({activeSubs.length} ativos)
        </button>
      </div>

      {/* CONTEÚDO */}
      {tab === 'planos' && (
        <div className="space-y-4">
          {plans.length === 0 ? (
            <div className="card p-12 text-center">
              <div className="inline-flex p-3 rounded-full bg-gold/10 text-gold mb-4">
                <Crown className="w-6 h-6" />
              </div>
              <h2
                className="text-xl font-bold text-fg mb-2"
                style={{ fontFamily: 'var(--font-playfair), serif' }}
              >
                Nenhum plano cadastrado
              </h2>
              <p className="text-sm text-fg-muted mb-6 max-w-md mx-auto">
                Crie planos mensais como &quot;4 cortes/mês por R$ 99&quot; e
                fidelize clientes.
              </p>
              <Link
                href="/admin/assinaturas/planos/novo"
                className="btn-gold-shimmer inline-flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>Criar primeiro plano</span>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {plans.map((p) => (
                <div
                  key={p.id}
                  className={`card p-5 relative ${
                    !p.active ? 'opacity-60' : ''
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <Crown
                      className={`w-5 h-5 ${
                        p.active ? 'text-gold' : 'text-fg-subtle'
                      }`}
                    />
                    <Link
                      href={`/admin/assinaturas/planos/${p.id}`}
                      className="text-xs text-fg-muted hover:text-gold flex items-center gap-1"
                    >
                      <Edit3 className="w-3 h-3" />
                      Editar
                    </Link>
                  </div>

                  <h3
                    className="text-lg font-bold text-fg mb-1"
                    style={{ fontFamily: 'var(--font-playfair), serif' }}
                  >
                    {p.name}
                  </h3>
                  {p.description && (
                    <p className="text-[11px] text-fg-subtle mb-3 line-clamp-2">
                      {p.description}
                    </p>
                  )}

                  <div className="flex items-baseline gap-1 mb-3">
                    <p
                      className="text-3xl font-bold text-gold"
                      style={{ fontFamily: 'var(--font-playfair), serif' }}
                    >
                      {formatCurrency(Number(p.price))}
                    </p>
                    <p className="text-xs text-fg-subtle">
                      / {cycleLabel(p.billing_cycle)}
                    </p>
                  </div>

                  <div className="space-y-1 text-xs text-fg-muted border-t border-border/40 pt-3">
                    {p.includes_count > 0 && (
                      <p>
                        ✓ <strong>{p.includes_count}</strong>{' '}
                        {p.includes_count === 1 ? 'atendimento' : 'atendimentos'}{' '}
                        por ciclo
                      </p>
                    )}
                    {Number(p.discount_percent_on_extras) > 0 && (
                      <p>
                        ✓ {Number(p.discount_percent_on_extras)}% de desconto em
                        extras
                      </p>
                    )}
                    {!p.active && (
                      <p className="text-fg-subtle italic">Inativo</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'assinantes' && (
        <div className="space-y-4">
          {/* BOTÃO NOVA ASSINATURA */}
          {plans.filter((p) => p.active).length > 0 && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowForm(!showForm)}
                className="btn-gold-shimmer flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>Nova assinatura</span>
              </button>
            </div>
          )}

          {/* FORM NOVA ASSINATURA */}
          {showForm && (
            <section className="card p-5 space-y-4 border-gold/30">
              <h3
                className="text-base font-semibold text-fg"
                style={{ fontFamily: 'var(--font-playfair), serif' }}
              >
                Criar nova assinatura
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="label">Cliente</label>
                  <select
                    value={formCustomerId}
                    onChange={(e) => setFormCustomerId(e.target.value)}
                    className="input"
                  >
                    <option value="">Selecione um cliente...</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.full_name}
                        {c.phone ? ` · ${c.phone}` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label">Plano</label>
                  <select
                    value={formPlanId}
                    onChange={(e) => setFormPlanId(e.target.value)}
                    className="input"
                  >
                    <option value="">Selecione um plano...</option>
                    {plans
                      .filter((p) => p.active)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} — {formatCurrency(Number(p.price))} /{' '}
                          {cycleLabel(p.billing_cycle)}
                        </option>
                      ))}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="label">Observações</label>
                  <input
                    type="text"
                    placeholder="Opcional..."
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    className="input"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="btn-secondary"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={isSaving}
                  className="btn-gold-shimmer flex items-center gap-2"
                >
                  {isSaving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  <span>Criar assinatura</span>
                </button>
              </div>
            </section>
          )}

          {/* LISTA ATIVOS */}
          {activeSubs.length === 0 && cancelledSubs.length === 0 ? (
            <div className="card p-12 text-center">
              <div className="inline-flex p-3 rounded-full bg-gold/10 text-gold mb-4">
                <Users className="w-6 h-6" />
              </div>
              <h2
                className="text-xl font-bold text-fg mb-2"
                style={{ fontFamily: 'var(--font-playfair), serif' }}
              >
                Nenhum assinante ainda
              </h2>
              <p className="text-sm text-fg-muted mb-2 max-w-md mx-auto">
                {plans.filter((p) => p.active).length === 0
                  ? 'Cadastre um plano primeiro para começar a vender assinaturas.'
                  : 'Crie uma assinatura para vincular um cliente a um plano.'}
              </p>
            </div>
          ) : (
            <>
              {activeSubs.length > 0 && (
                <section className="card overflow-hidden">
                  <div className="p-4 bg-bg-elevated border-b border-border">
                    <p className="text-sm font-semibold text-success">
                      ● Assinantes ativos ({activeSubs.length})
                    </p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border/60">
                          <th className="text-left py-2 px-4 text-[10px] uppercase tracking-wider text-fg-dim">
                            Cliente
                          </th>
                          <th className="text-left py-2 px-4 text-[10px] uppercase tracking-wider text-fg-dim">
                            Plano
                          </th>
                          <th className="text-left py-2 px-4 text-[10px] uppercase tracking-wider text-fg-dim">
                            Próx. Renovação
                          </th>
                          <th className="text-left py-2 px-4 text-[10px] uppercase tracking-wider text-fg-dim">
                            Usos restantes
                          </th>
                          <th className="text-right py-2 px-4 text-[10px] uppercase tracking-wider text-fg-dim">
                            Ações
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeSubs.map((s) => (
                          <tr
                            key={s.id}
                            className="border-b border-border/40 hover:bg-bg-elevated/40"
                          >
                            <td className="py-3 px-4">
                              <p className="text-fg font-medium">
                                {s.customer_name}
                              </p>
                              {s.customer_phone && (
                                <p className="text-[11px] text-fg-subtle">
                                  {s.customer_phone}
                                </p>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              <p className="text-fg-muted">{s.plan_name}</p>
                              <p className="text-[11px] text-fg-subtle">
                                {formatCurrency(s.plan_price)}
                              </p>
                            </td>
                            <td className="py-3 px-4 text-fg-muted text-xs">
                              {formatDate(s.current_period_end)}
                            </td>
                            <td className="py-3 px-4">
                              <span className="badge-gold text-[11px]">
                                {s.remaining_uses}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="inline-flex gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleRenew(s.id)}
                                  disabled={actioningId === s.id}
                                  title="Renovar para próximo ciclo"
                                  className="p-1.5 rounded hover:bg-info/10 text-info disabled:opacity-50"
                                >
                                  {actioningId === s.id ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <Repeat className="w-3.5 h-3.5" />
                                  )}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleCancel(s.id)}
                                  disabled={actioningId === s.id}
                                  title="Cancelar assinatura"
                                  className="p-1.5 rounded hover:bg-danger/10 text-danger disabled:opacity-50"
                                >
                                  <XCircle className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {cancelledSubs.length > 0 && (
                <section className="card overflow-hidden">
                  <div className="p-4 bg-bg-elevated border-b border-border">
                    <p className="text-sm font-semibold text-fg-subtle">
                      ○ Cancelados ({cancelledSubs.length})
                    </p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <tbody>
                        {cancelledSubs.map((s) => (
                          <tr
                            key={s.id}
                            className="border-b border-border/40 opacity-60"
                          >
                            <td className="py-3 px-4">
                              <p className="text-fg-muted">{s.customer_name}</p>
                            </td>
                            <td className="py-3 px-4 text-fg-subtle text-xs">
                              {s.plan_name}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <button
                                type="button"
                                onClick={() => handleReactivate(s.id)}
                                disabled={actioningId === s.id}
                                title="Reativar"
                                className="p-1.5 rounded hover:bg-success/10 text-success disabled:opacity-50"
                              >
                                {actioningId === s.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <RotateCcw className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
