'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Save, Plus } from 'lucide-react';
import { upsertGoal, deleteGoal } from '../actions';
import { formatCurrency } from '@/lib/utils';

interface StaffOpt {
  id: string;
  display_name: string;
}

interface ExistingGoal {
  id: string;
  staff_id: string | null;
  revenue_target: number;
  staff_name: string | null;
}

interface GoalsManagerProps {
  staff: StaffOpt[];
  currentYear: number;
  currentMonth: number;
  existingGoals: ExistingGoal[];
}

export function GoalsManager({
  staff,
  currentYear,
  currentMonth,
  existingGoals,
}: GoalsManagerProps) {
  const router = useRouter();
  const [staffId, setStaffId] = useState<string>('');
  const [target, setTarget] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleSave() {
    const numericTarget = Number(target.replace(',', '.'));
    if (!numericTarget || numericTarget <= 0) {
      toast.error('Informe um valor de meta válido.');
      return;
    }
    setIsLoading(true);
    const result = await upsertGoal({
      staff_id: staffId || null,
      period_type: 'month',
      year: currentYear,
      month: currentMonth,
      revenue_target: numericTarget,
    });
    if (result.ok) {
      toast.success('Meta salva!');
      setTarget('');
      setStaffId('');
      router.refresh();
    } else {
      toast.error(result.error ?? 'Erro ao salvar.');
    }
    setIsLoading(false);
  }

  async function handleDelete(goalId: string) {
    if (!confirm('Remover esta meta?')) return;
    setDeletingId(goalId);
    const result = await deleteGoal(goalId);
    if (result.ok) {
      toast.success('Meta removida.');
      router.refresh();
    } else {
      toast.error(result.error ?? 'Erro ao remover.');
    }
    setDeletingId(null);
  }

  return (
    <section className="card p-6 space-y-4">
      <h2
        className="text-lg font-semibold text-fg"
        style={{ fontFamily: 'var(--font-playfair), serif' }}
      >
        Definir ou Atualizar Meta
      </h2>

      <p className="text-[11px] text-fg-subtle">
        Defina uma meta mensal de faturamento. Selecionar &quot;Toda a barbearia&quot;
        cria uma meta consolidada. Selecionar um profissional cria meta
        individual.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-[2fr_2fr_auto] gap-3 items-end">
        <div>
          <label className="label">Aplica a</label>
          <select
            value={staffId}
            onChange={(e) => setStaffId(e.target.value)}
            className="input"
          >
            <option value="">Toda a barbearia</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.display_name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Meta de faturamento (R$)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            placeholder="Ex: 15000.00"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            className="input"
          />
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={isLoading}
          className="btn-gold-shimmer flex items-center gap-2"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          <span>Salvar meta</span>
        </button>
      </div>

      {existingGoals.length > 0 && (
        <div className="pt-4 border-t border-border/60 space-y-2">
          <p className="text-[10px] uppercase tracking-wider text-fg-dim">
            Metas definidas neste mês
          </p>
          {existingGoals.map((g) => (
            <div
              key={g.id}
              className="flex items-center justify-between gap-3 p-3 rounded-md bg-bg-elevated border border-border/60"
            >
              <div>
                <p className="text-sm text-fg">
                  {g.staff_name ?? (
                    <span className="text-gold">Toda a barbearia</span>
                  )}
                </p>
                <p className="text-xs text-fg-subtle">
                  Meta: <strong>{formatCurrency(g.revenue_target)}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleDelete(g.id)}
                disabled={deletingId === g.id}
                className="text-xs text-danger hover:bg-danger/10 px-3 py-1.5 rounded-md transition-colors"
              >
                {deletingId === g.id ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  'Remover'
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
