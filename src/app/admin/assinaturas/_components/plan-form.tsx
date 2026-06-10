'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { Loader2, Save, ArrowLeft, Crown } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { DAY_LABELS_SHORT } from '@/lib/subscriptions';
import { createPlan, updatePlan, type PlanFormData } from '../actions';

const PERIOD_OPTIONS = [
  { value: 'monthly', label: 'Mensal' },
  { value: 'quarterly', label: 'Trimestral' },
  { value: 'semiannual', label: 'Semestral' },
  { value: 'annual', label: 'Anual' },
];

interface PlanFormProps {
  planId?: string;
  defaultValues?: Partial<PlanFormData>;
}

export function PlanForm({ planId, defaultValues }: PlanFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const [form, setForm] = useState({
    name: defaultValues?.name ?? '',
    description: defaultValues?.description ?? '',
    price: defaultValues?.price ?? 119.9,
    period: defaultValues?.period ?? 'monthly',
    allowed_days: defaultValues?.allowed_days ?? [1, 2, 3, 4, 5, 6],
    included_uses: defaultValues?.included_uses ?? 4,
    barber_share_percent: defaultValues?.barber_share_percent ?? 50,
    accumulate_unused: defaultValues?.accumulate_unused ?? false,
    show_on_public_menu: defaultValues?.show_on_public_menu ?? true,
    active: defaultValues?.active ?? true,
    display_order: defaultValues?.display_order ?? 0,
  });

  function toggleDay(day: number) {
    setForm((f) => ({
      ...f,
      allowed_days: f.allowed_days.includes(day)
        ? f.allowed_days.filter((d) => d !== day)
        : [...f.allowed_days, day].sort((a, b) => a - b),
    }));
  }

  const poolValue = (Number(form.price) * Number(form.barber_share_percent)) / 100;

  async function handleSubmit() {
    if (!form.name.trim()) {
      toast.error('Informe o nome do plano');
      return;
    }
    if (Number(form.price) <= 0) {
      toast.error('Informe um preço válido');
      return;
    }
    if (form.allowed_days.length === 0) {
      toast.error('Selecione ao menos um dia da semana');
      return;
    }
    if (Number(form.included_uses) <= 0) {
      toast.error('Informe quantos atendimentos o plano inclui');
      return;
    }

    setIsLoading(true);
    const payload: PlanFormData = {
      name: form.name.trim(),
      description: form.description || null,
      price: Number(form.price),
      period: form.period,
      allowed_days: form.allowed_days,
      included_uses: Number(form.included_uses),
      barber_share_percent: Number(form.barber_share_percent),
      accumulate_unused: form.accumulate_unused,
      show_on_public_menu: form.show_on_public_menu,
      active: form.active,
      display_order: Number(form.display_order) || 0,
    };

    const result = planId
      ? await updatePlan(planId, payload)
      : await createPlan(payload);

    setIsLoading(false);

    if (result.ok) {
      toast.success(planId ? 'Plano atualizado!' : 'Plano criado!');
      router.push('/admin/assinaturas');
      router.refresh();
    } else {
      toast.error(result.error ?? 'Erro ao salvar');
    }
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      <div>
        <Link
          href="/admin/assinaturas"
          className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-gold transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar para assinaturas</span>
        </Link>
        <p className="text-[10px] text-fg-dim tracking-[0.25em] uppercase mb-1">
          {planId ? 'Editar' : 'Criar'}
        </p>
        <h1
          className="text-3xl text-fg font-bold"
          style={{ fontFamily: 'var(--font-playfair), serif' }}
        >
          {planId ? 'Editar Plano' : 'Novo Plano'}
        </h1>
      </div>

      <div className="divider-gold" />

      <section className="card p-6 space-y-4">
        <h2
          className="text-lg font-semibold text-fg flex items-center gap-2"
          style={{ fontFamily: 'var(--font-playfair), serif' }}
        >
          <Crown className="w-4 h-4 text-gold" />
          Dados do plano
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="label">Nome do plano *</label>
            <input
              type="text"
              placeholder="Ex: Clube do Corte"
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>

          <div className="md:col-span-2">
            <label className="label">Descrição</label>
            <textarea
              rows={2}
              placeholder="Ex: 4 cortes por mês com prioridade de agenda"
              className="input resize-none"
              value={form.description ?? ''}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>

          <div>
            <label className="label">Preço (R$) *</label>
            <input
              type="number"
              step="0.01"
              min="0"
              className="input"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
            />
          </div>

          <div>
            <label className="label">Cobrança</label>
            <select
              className="input"
              value={form.period}
              onChange={(e) => setForm({ ...form, period: e.target.value })}
            >
              {PERIOD_OPTIONS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Atendimentos por ciclo *</label>
            <input
              type="number"
              min="1"
              className="input"
              value={form.included_uses}
              onChange={(e) =>
                setForm({ ...form, included_uses: Number(e.target.value) })
              }
            />
            <p className="text-[11px] text-fg-subtle mt-1">
              Ex: 4 cortes por mês. O contador zera quando o pagamento da
              renovação é lançado.
            </p>
          </div>

          <div>
            <label className="label">Ordem de exibição</label>
            <input
              type="number"
              min="0"
              className="input"
              value={form.display_order}
              onChange={(e) =>
                setForm({ ...form, display_order: Number(e.target.value) })
              }
            />
          </div>
        </div>
      </section>

      <section className="card p-6 space-y-4">
        <h2
          className="text-lg font-semibold text-fg"
          style={{ fontFamily: 'var(--font-playfair), serif' }}
        >
          Dias permitidos
        </h2>
        <p className="text-xs text-fg-muted -mt-2">
          O cliente pode agendar fora desses dias, mas o atendimento não conta
          como uso do plano (cobra avulso) e ele é avisado.
        </p>

        <div className="flex flex-wrap gap-2">
          {DAY_LABELS_SHORT.map((label, day) => {
            const selected = form.allowed_days.includes(day);
            return (
              <button
                key={day}
                type="button"
                onClick={() => toggleDay(day)}
                className={cn(
                  'px-4 py-2.5 rounded-md text-xs font-semibold transition-all border',
                  selected
                    ? 'bg-gold text-bg border-gold shadow-gold'
                    : 'bg-bg-elevated text-fg-muted border-border hover:border-gold/30'
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
      </section>

      <section className="card p-6 space-y-4">
        <h2
          className="text-lg font-semibold text-fg"
          style={{ fontFamily: 'var(--font-playfair), serif' }}
        >
          Potinho dos barbeiros
        </h2>
        <p className="text-xs text-fg-muted -mt-2">
          Percentual do valor do plano que é dividido entre os barbeiros que
          atenderam o assinante no ciclo, proporcional aos atendimentos. Sem
          visitas no ciclo, o valor fica integral para a barbearia.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
          <div>
            <label className="label">Parte dos barbeiros (%)</label>
            <input
              type="number"
              min="0"
              max="100"
              step="1"
              className="input"
              value={form.barber_share_percent}
              onChange={(e) =>
                setForm({
                  ...form,
                  barber_share_percent: Number(e.target.value),
                })
              }
            />
          </div>
          <div className="card-premium p-4">
            <p className="text-[9px] uppercase tracking-wider text-fg-dim mb-1">
              Potinho por ciclo
            </p>
            <p
              className="text-xl font-bold text-gold leading-none"
              style={{ fontFamily: 'var(--font-playfair), serif' }}
            >
              {formatCurrency(poolValue)}
            </p>
            <p className="text-[10px] text-fg-subtle mt-1">
              Barbearia fica com {formatCurrency(Number(form.price) - poolValue)}
            </p>
          </div>
        </div>
      </section>

      <section className="card p-6 space-y-3">
        <h2
          className="text-lg font-semibold text-fg mb-2"
          style={{ fontFamily: 'var(--font-playfair), serif' }}
        >
          Opções
        </h2>

        <label className="flex items-start gap-3 p-3 rounded-md bg-bg-elevated border border-border cursor-pointer hover:border-gold/30 transition-colors">
          <input
            type="checkbox"
            className="w-4 h-4 accent-gold mt-0.5 cursor-pointer"
            checked={form.show_on_public_menu}
            onChange={(e) =>
              setForm({ ...form, show_on_public_menu: e.target.checked })
            }
          />
          <div>
            <p className="text-sm text-fg font-medium">Exibir no site público</p>
            <p className="text-[11px] text-fg-subtle">
              O plano aparece na página pública e na futura landing page.
            </p>
          </div>
        </label>

        <label className="flex items-start gap-3 p-3 rounded-md bg-bg-elevated border border-border cursor-pointer hover:border-gold/30 transition-colors">
          <input
            type="checkbox"
            className="w-4 h-4 accent-gold mt-0.5 cursor-pointer"
            checked={form.accumulate_unused}
            onChange={(e) =>
              setForm({ ...form, accumulate_unused: e.target.checked })
            }
          />
          <div>
            <p className="text-sm text-fg font-medium">
              Acumular usos não utilizados
            </p>
            <p className="text-[11px] text-fg-subtle">
              Reservado para evolução futura (hoje o ciclo sempre zera no
              pagamento).
            </p>
          </div>
        </label>

        <label className="flex items-start gap-3 p-3 rounded-md bg-bg-elevated border border-border cursor-pointer hover:border-gold/30 transition-colors">
          <input
            type="checkbox"
            className="w-4 h-4 accent-gold mt-0.5 cursor-pointer"
            checked={form.active}
            onChange={(e) => setForm({ ...form, active: e.target.checked })}
          />
          <div>
            <p className="text-sm text-fg font-medium">Plano ativo</p>
            <p className="text-[11px] text-fg-subtle">
              Planos inativos não aceitam novas assinaturas.
            </p>
          </div>
        </label>
      </section>

      <div className="flex items-center justify-end gap-3">
        <Link href="/admin/assinaturas" className="btn-secondary">
          Cancelar
        </Link>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isLoading}
          className="btn-gold-shimmer flex items-center gap-2"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Salvando...</span>
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              <span>{planId ? 'Salvar alterações' : 'Criar plano'}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
