'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Loader2,
  Save,
  Plus,
  Edit3,
  Trash2,
  Gift,
  Sparkles,
  History,
  Trophy,
  Sliders,
  Users,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

import {
  updateLoyaltyConfig,
  createReward,
  updateReward,
  deleteReward,
  adjustCustomerPoints,
  redeemReward,
} from '../actions';

interface Reward {
  id: string;
  name: string;
  description: string | null;
  points_required: number;
  reward_type: string;
  reward_value: number | null;
  service_id: string | null;
  product_id: string | null;
  active: boolean;
  display_order: number;
}

interface Balance {
  customer_id: string;
  customer_name: string;
  customer_phone: string | null;
  balance: number;
  lifetime_earned: number;
  lifetime_redeemed: number;
}

interface Transaction {
  id: string;
  customer_id: string;
  customer_name: string;
  type: string;
  points: number;
  reason: string | null;
  created_at: string;
}

interface Opt {
  id: string;
  name: string;
}

interface CustomerOpt {
  id: string;
  full_name: string;
  phone: string | null;
}

interface FidelidadeViewProps {
  loyaltyEnabled: boolean;
  pointsPerBrl: number;
  rewards: Reward[];
  services: Opt[];
  products: Opt[];
  balances: Balance[];
  customers: CustomerOpt[];
  transactions: Transaction[];
}

type Tab = 'config' | 'rewards' | 'balances' | 'history';

export function FidelidadeView({
  loyaltyEnabled,
  pointsPerBrl,
  rewards,
  services,
  products,
  balances,
  customers,
  transactions,
}: FidelidadeViewProps) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('config');

  // CONFIG state
  const [cfgEnabled, setCfgEnabled] = useState(loyaltyEnabled);
  const [cfgPoints, setCfgPoints] = useState(String(pointsPerBrl));
  const [isSavingCfg, setIsSavingCfg] = useState(false);

  // REWARDS state
  const [showRewardForm, setShowRewardForm] = useState(false);
  const [editingReward, setEditingReward] = useState<Reward | null>(null);
  const [rwName, setRwName] = useState('');
  const [rwDescription, setRwDescription] = useState('');
  const [rwPoints, setRwPoints] = useState('100');
  const [rwType, setRwType] = useState('discount');
  const [rwValue, setRwValue] = useState('');
  const [rwServiceId, setRwServiceId] = useState('');
  const [rwProductId, setRwProductId] = useState('');
  const [isSavingRw, setIsSavingRw] = useState(false);
  const [deletingRwId, setDeletingRwId] = useState<string | null>(null);

  // ADJUST state
  const [adjCustomer, setAdjCustomer] = useState('');
  const [adjDelta, setAdjDelta] = useState('');
  const [adjReason, setAdjReason] = useState('');
  const [isAdjusting, setIsAdjusting] = useState(false);

  // REDEEM state
  const [redeemCustomer, setRedeemCustomer] = useState('');
  const [redeemReward_, setRedeemReward] = useState('');
  const [isRedeeming, setIsRedeeming] = useState(false);

  async function handleSaveConfig() {
    setIsSavingCfg(true);
    const result = await updateLoyaltyConfig({
      loyalty_enabled: cfgEnabled,
      loyalty_points_per_brl: Number(cfgPoints.replace(',', '.')) || 0,
    });
    if (result.ok) {
      toast.success('Configuração salva!');
      router.refresh();
    } else {
      toast.error(result.error ?? 'Erro.');
    }
    setIsSavingCfg(false);
  }

  function openRewardForm(reward?: Reward) {
    if (reward) {
      setEditingReward(reward);
      setRwName(reward.name);
      setRwDescription(reward.description ?? '');
      setRwPoints(String(reward.points_required));
      setRwType(reward.reward_type);
      setRwValue(reward.reward_value != null ? String(reward.reward_value) : '');
      setRwServiceId(reward.service_id ?? '');
      setRwProductId(reward.product_id ?? '');
    } else {
      setEditingReward(null);
      setRwName('');
      setRwDescription('');
      setRwPoints('100');
      setRwType('discount');
      setRwValue('');
      setRwServiceId('');
      setRwProductId('');
    }
    setShowRewardForm(true);
  }

  async function handleSaveReward() {
    if (!rwName) {
      toast.error('Nome obrigatório');
      return;
    }
    setIsSavingRw(true);
    const data = {
      name: rwName,
      description: rwDescription,
      points_required: Number(rwPoints) || 0,
      reward_type: rwType,
      reward_value: rwValue ? Number(rwValue) : null,
      service_id: rwType === 'free_service' ? rwServiceId || null : null,
      product_id: rwType === 'free_product' ? rwProductId || null : null,
    };
    const result = editingReward
      ? await updateReward(editingReward.id, data)
      : await createReward(data);
    if (result.ok) {
      toast.success(editingReward ? 'Prêmio atualizado!' : 'Prêmio criado!');
      setShowRewardForm(false);
      setEditingReward(null);
      router.refresh();
    } else {
      toast.error(result.error ?? 'Erro.');
    }
    setIsSavingRw(false);
  }

  async function handleDeleteReward(id: string) {
    if (!confirm('Desativar este prêmio?')) return;
    setDeletingRwId(id);
    const result = await deleteReward(id);
    if (result.ok) {
      toast.success('Prêmio desativado.');
      router.refresh();
    } else {
      toast.error(result.error ?? 'Erro.');
    }
    setDeletingRwId(null);
  }

  async function handleAdjust() {
    if (!adjCustomer || !adjDelta || !adjReason) {
      toast.error('Preencha todos os campos.');
      return;
    }
    const delta = parseInt(adjDelta, 10);
    if (!delta || isNaN(delta)) {
      toast.error('Valor inválido.');
      return;
    }
    setIsAdjusting(true);
    const result = await adjustCustomerPoints(adjCustomer, delta, adjReason);
    if (result.ok) {
      toast.success(`${delta > 0 ? '+' : ''}${delta} pontos aplicados!`);
      setAdjCustomer('');
      setAdjDelta('');
      setAdjReason('');
      router.refresh();
    } else {
      toast.error(result.error ?? 'Erro.');
    }
    setIsAdjusting(false);
  }

  async function handleRedeem() {
    if (!redeemCustomer || !redeemReward_) {
      toast.error('Selecione cliente e prêmio.');
      return;
    }
    setIsRedeeming(true);
    const result = await redeemReward(redeemCustomer, redeemReward_);
    if (result.ok) {
      toast.success('Prêmio resgatado!');
      setRedeemCustomer('');
      setRedeemReward('');
      router.refresh();
    } else {
      toast.error(result.error ?? 'Erro.');
    }
    setIsRedeeming(false);
  }

  const typeLabel = (t: string) => {
    const map: Record<string, string> = {
      discount: 'Desconto em R$',
      free_service: 'Serviço grátis',
      free_product: 'Produto grátis',
      other: 'Outro',
    };
    return map[t] ?? t;
  };

  const txTypeLabel = (t: string) => {
    const map: Record<string, { label: string; cls: string }> = {
      earn: { label: 'Ganho', cls: 'text-success' },
      redeem: { label: 'Resgate', cls: 'text-warning' },
      adjust: { label: 'Ajuste', cls: 'text-info' },
    };
    return map[t] ?? { label: t, cls: 'text-fg' };
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });

  const TabBtn = ({
    value,
    label,
    icon: Icon,
  }: {
    value: Tab;
    label: string;
    icon: typeof Sliders;
  }) => (
    <button
      type="button"
      onClick={() => setTab(value)}
      className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
        tab === value
          ? 'border-gold text-gold'
          : 'border-transparent text-fg-muted hover:text-fg'
      }`}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );

  return (
    <div className="space-y-4">
      {/* TABS */}
      <div className="flex flex-wrap gap-1 border-b border-border">
        <TabBtn value="config" label="Configuração" icon={Sliders} />
        <TabBtn value="rewards" label={`Prêmios (${rewards.length})`} icon={Gift} />
        <TabBtn value="balances" label={`Saldos (${balances.length})`} icon={Users} />
        <TabBtn value="history" label="Histórico" icon={History} />
      </div>

      {/* CONFIG */}
      {tab === 'config' && (
        <section className="card p-6 space-y-4 max-w-3xl">
          <h2
            className="text-lg font-semibold text-fg"
            style={{ fontFamily: 'var(--font-playfair), serif' }}
          >
            Regras do Programa
          </h2>

          <label className="flex items-start gap-3 p-3 rounded-md bg-bg-elevated border border-border cursor-pointer hover:border-gold/30 transition-colors">
            <input
              type="checkbox"
              className="w-4 h-4 accent-gold mt-0.5 cursor-pointer"
              checked={cfgEnabled}
              onChange={(e) => setCfgEnabled(e.target.checked)}
            />
            <div>
              <p className="text-sm text-fg font-medium">
                Habilitar programa de fidelidade
              </p>
              <p className="text-[11px] text-fg-subtle">
                Quando ativado, clientes acumulam pontos automaticamente em compras.
              </p>
            </div>
          </label>

          <div>
            <label className="label">Pontos por R$ gasto</label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                step="0.1"
                min="0"
                value={cfgPoints}
                onChange={(e) => setCfgPoints(e.target.value)}
                className="input max-w-[140px]"
              />
              <p className="text-xs text-fg-subtle">
                Ex: <strong>1</strong> = a cada R$ 1 gasto, ganha 1 ponto. <strong>0.5</strong> = a cada R$ 2 gastos, ganha 1 ponto.
              </p>
            </div>
          </div>

          <div className="pt-3 border-t border-border/60">
            <p className="text-[11px] text-fg-subtle">
              💡 Exemplo: cliente gastando R$ 100 com a taxa de{' '}
              <strong>{cfgPoints || 1}</strong> ganhará{' '}
              <strong className="text-gold">
                {Math.floor(100 * (Number(cfgPoints || 1) || 0))} pontos
              </strong>
              .
            </p>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleSaveConfig}
              disabled={isSavingCfg}
              className="btn-gold-shimmer flex items-center gap-2"
            >
              {isSavingCfg ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              <span>Salvar configuração</span>
            </button>
          </div>
        </section>
      )}

      {/* REWARDS */}
      {tab === 'rewards' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => openRewardForm()}
              className="btn-gold-shimmer flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Novo prêmio</span>
            </button>
          </div>

          {showRewardForm && (
            <section className="card p-5 space-y-4 border-gold/30">
              <h3
                className="text-base font-semibold text-fg"
                style={{ fontFamily: 'var(--font-playfair), serif' }}
              >
                {editingReward ? 'Editar prêmio' : 'Novo prêmio'}
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="md:col-span-2">
                  <label className="label">Nome *</label>
                  <input
                    type="text"
                    placeholder='Ex: "Corte grátis"'
                    value={rwName}
                    onChange={(e) => setRwName(e.target.value)}
                    className="input"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="label">Descrição</label>
                  <input
                    type="text"
                    placeholder="Detalhes do prêmio..."
                    value={rwDescription}
                    onChange={(e) => setRwDescription(e.target.value)}
                    className="input"
                  />
                </div>

                <div>
                  <label className="label">Pontos necessários *</label>
                  <input
                    type="number"
                    min="0"
                    value={rwPoints}
                    onChange={(e) => setRwPoints(e.target.value)}
                    className="input"
                  />
                </div>

                <div>
                  <label className="label">Tipo de prêmio</label>
                  <select
                    value={rwType}
                    onChange={(e) => setRwType(e.target.value)}
                    className="input"
                  >
                    <option value="discount">Desconto em R$</option>
                    <option value="free_service">Serviço grátis</option>
                    <option value="free_product">Produto grátis</option>
                    <option value="other">Outro</option>
                  </select>
                </div>

                {rwType === 'discount' && (
                  <div>
                    <label className="label">Valor do desconto (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Ex: 20.00"
                      value={rwValue}
                      onChange={(e) => setRwValue(e.target.value)}
                      className="input"
                    />
                  </div>
                )}

                {rwType === 'free_service' && (
                  <div>
                    <label className="label">Serviço grátis</label>
                    <select
                      value={rwServiceId}
                      onChange={(e) => setRwServiceId(e.target.value)}
                      className="input"
                    >
                      <option value="">Selecione um serviço</option>
                      {services.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {rwType === 'free_product' && (
                  <div>
                    <label className="label">Produto grátis</label>
                    <select
                      value={rwProductId}
                      onChange={(e) => setRwProductId(e.target.value)}
                      className="input"
                    >
                      <option value="">Selecione um produto</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowRewardForm(false);
                    setEditingReward(null);
                  }}
                  className="btn-secondary"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveReward}
                  disabled={isSavingRw}
                  className="btn-gold-shimmer flex items-center gap-2"
                >
                  {isSavingRw ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  <span>{editingReward ? 'Salvar alterações' : 'Criar prêmio'}</span>
                </button>
              </div>
            </section>
          )}

          {rewards.length === 0 ? (
            <div className="card p-12 text-center">
              <div className="inline-flex p-3 rounded-full bg-gold/10 text-gold mb-4">
                <Gift className="w-6 h-6" />
              </div>
              <h2
                className="text-xl font-bold text-fg mb-2"
                style={{ fontFamily: 'var(--font-playfair), serif' }}
              >
                Nenhum prêmio cadastrado
              </h2>
              <p className="text-sm text-fg-muted mb-2 max-w-md mx-auto">
                Cadastre prêmios que clientes poderão resgatar com seus pontos.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {rewards.map((r) => (
                <div
                  key={r.id}
                  className={`card p-5 relative ${
                    !r.active ? 'opacity-60' : ''
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <Trophy
                      className={`w-5 h-5 ${
                        r.active ? 'text-gold' : 'text-fg-subtle'
                      }`}
                    />
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => openRewardForm(r)}
                        className="p-1.5 rounded hover:bg-gold/10 text-fg-muted hover:text-gold"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteReward(r.id)}
                        disabled={deletingRwId === r.id}
                        className="p-1.5 rounded hover:bg-danger/10 text-fg-muted hover:text-danger"
                      >
                        {deletingRwId === r.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  <h3
                    className="text-base font-bold text-fg mb-1"
                    style={{ fontFamily: 'var(--font-playfair), serif' }}
                  >
                    {r.name}
                  </h3>
                  {r.description && (
                    <p className="text-[11px] text-fg-subtle mb-3 line-clamp-2">
                      {r.description}
                    </p>
                  )}

                  <div className="flex items-baseline gap-1 mb-2">
                    <p
                      className="text-2xl font-bold text-gold"
                      style={{ fontFamily: 'var(--font-playfair), serif' }}
                    >
                      {r.points_required}
                    </p>
                    <p className="text-xs text-fg-subtle">pontos</p>
                  </div>

                  <div className="text-[11px] text-fg-muted border-t border-border/40 pt-2 space-y-0.5">
                    <p>
                      <span className="text-fg-dim uppercase tracking-wider">
                        Tipo:
                      </span>{' '}
                      {typeLabel(r.reward_type)}
                    </p>
                    {r.reward_value != null &&
                      r.reward_type === 'discount' && (
                        <p>
                          <span className="text-fg-dim uppercase tracking-wider">
                            Valor:
                          </span>{' '}
                          {formatCurrency(Number(r.reward_value))}
                        </p>
                      )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* FORM DE RESGATE */}
          {rewards.filter((r) => r.active).length > 0 && balances.length > 0 && (
            <section className="card p-5 space-y-3 border-gold/20">
              <h3
                className="text-base font-semibold text-fg flex items-center gap-2"
                style={{ fontFamily: 'var(--font-playfair), serif' }}
              >
                <Gift className="w-4 h-4 text-gold" />
                Registrar resgate
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                <div>
                  <label className="label">Cliente</label>
                  <select
                    value={redeemCustomer}
                    onChange={(e) => setRedeemCustomer(e.target.value)}
                    className="input"
                  >
                    <option value="">Selecione...</option>
                    {balances.map((b) => (
                      <option key={b.customer_id} value={b.customer_id}>
                        {b.customer_name} ({b.balance} pts)
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Prêmio</label>
                  <select
                    value={redeemReward_}
                    onChange={(e) => setRedeemReward(e.target.value)}
                    className="input"
                  >
                    <option value="">Selecione...</option>
                    {rewards
                      .filter((r) => r.active)
                      .map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name} ({r.points_required} pts)
                        </option>
                      ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={handleRedeem}
                  disabled={isRedeeming}
                  className="btn-gold-shimmer flex items-center gap-2 justify-center"
                >
                  {isRedeeming ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Gift className="w-4 h-4" />
                  )}
                  <span>Resgatar</span>
                </button>
              </div>
            </section>
          )}
        </div>
      )}

      {/* BALANCES */}
      {tab === 'balances' && (
        <div className="space-y-4">
          {/* AJUSTE MANUAL */}
          <section className="card p-5 space-y-3 border-gold/20">
            <h3
              className="text-base font-semibold text-fg flex items-center gap-2"
              style={{ fontFamily: 'var(--font-playfair), serif' }}
            >
              <Sparkles className="w-4 h-4 text-gold" />
              Ajuste manual de pontos
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
              <div>
                <label className="label">Cliente</label>
                <select
                  value={adjCustomer}
                  onChange={(e) => setAdjCustomer(e.target.value)}
                  className="input"
                >
                  <option value="">Selecione...</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.full_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Pontos (use - para subtrair)</label>
                <input
                  type="number"
                  placeholder="+10 ou -50"
                  value={adjDelta}
                  onChange={(e) => setAdjDelta(e.target.value)}
                  className="input"
                />
              </div>
              <div>
                <label className="label">Motivo</label>
                <input
                  type="text"
                  placeholder="Ex: bonificação aniversário"
                  value={adjReason}
                  onChange={(e) => setAdjReason(e.target.value)}
                  className="input"
                />
              </div>
              <button
                type="button"
                onClick={handleAdjust}
                disabled={isAdjusting}
                className="btn-gold-shimmer flex items-center gap-2 justify-center"
              >
                {isAdjusting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                <span>Aplicar</span>
              </button>
            </div>
          </section>

          {/* LISTA */}
          {balances.length === 0 ? (
            <div className="card p-12 text-center">
              <div className="inline-flex p-3 rounded-full bg-gold/10 text-gold mb-4">
                <Users className="w-6 h-6" />
              </div>
              <h2
                className="text-xl font-bold text-fg mb-2"
                style={{ fontFamily: 'var(--font-playfair), serif' }}
              >
                Nenhum cliente com pontos
              </h2>
              <p className="text-sm text-fg-muted mb-2 max-w-md mx-auto">
                Quando clientes acumularem pontos, eles aparecerão aqui.
              </p>
            </div>
          ) : (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-bg-elevated">
                      <th className="text-left py-3 px-4 text-[10px] uppercase tracking-wider text-fg-dim">
                        Cliente
                      </th>
                      <th className="text-right py-3 px-4 text-[10px] uppercase tracking-wider text-fg-dim">
                        Saldo
                      </th>
                      <th className="text-right py-3 px-4 text-[10px] uppercase tracking-wider text-fg-dim">
                        Total ganho
                      </th>
                      <th className="text-right py-3 px-4 text-[10px] uppercase tracking-wider text-fg-dim">
                        Total resgatado
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {balances.map((b) => (
                      <tr
                        key={b.customer_id}
                        className="border-b border-border/40"
                      >
                        <td className="py-3 px-4">
                          <p className="text-fg font-medium">{b.customer_name}</p>
                          {b.customer_phone && (
                            <p className="text-[11px] text-fg-subtle">
                              {b.customer_phone}
                            </p>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className="badge-gold text-sm font-bold">
                            {b.balance.toLocaleString('pt-BR')}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right text-fg-muted">
                          {b.lifetime_earned.toLocaleString('pt-BR')}
                        </td>
                        <td className="py-3 px-4 text-right text-fg-muted">
                          {b.lifetime_redeemed.toLocaleString('pt-BR')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* HISTORY */}
      {tab === 'history' && (
        <div className="card overflow-hidden">
          {transactions.length === 0 ? (
            <div className="p-12 text-center">
              <div className="inline-flex p-3 rounded-full bg-gold/10 text-gold mb-4">
                <History className="w-6 h-6" />
              </div>
              <h2
                className="text-xl font-bold text-fg mb-2"
                style={{ fontFamily: 'var(--font-playfair), serif' }}
              >
                Sem histórico
              </h2>
              <p className="text-sm text-fg-muted">
                Movimentações de pontos aparecerão aqui.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-bg-elevated">
                    <th className="text-left py-3 px-4 text-[10px] uppercase tracking-wider text-fg-dim">
                      Data
                    </th>
                    <th className="text-left py-3 px-4 text-[10px] uppercase tracking-wider text-fg-dim">
                      Cliente
                    </th>
                    <th className="text-left py-3 px-4 text-[10px] uppercase tracking-wider text-fg-dim">
                      Tipo
                    </th>
                    <th className="text-left py-3 px-4 text-[10px] uppercase tracking-wider text-fg-dim">
                      Motivo
                    </th>
                    <th className="text-right py-3 px-4 text-[10px] uppercase tracking-wider text-fg-dim">
                      Pontos
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((t) => {
                    const lbl = txTypeLabel(t.type);
                    return (
                      <tr
                        key={t.id}
                        className="border-b border-border/40"
                      >
                        <td className="py-3 px-4 text-fg-subtle text-xs">
                          {formatDate(t.created_at)}
                        </td>
                        <td className="py-3 px-4 text-fg">
                          {t.customer_name}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`text-xs font-medium ${lbl.cls}`}>
                            {lbl.label}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-fg-muted text-xs">
                          {t.reason ?? '—'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span
                            className={`text-sm font-bold ${
                              t.points > 0 ? 'text-success' : 'text-warning'
                            }`}
                          >
                            {t.points > 0 ? '+' : ''}
                            {t.points.toLocaleString('pt-BR')}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
