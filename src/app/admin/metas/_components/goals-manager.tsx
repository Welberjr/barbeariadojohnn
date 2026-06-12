﻿'use client';

import { useConfirm } from '@/components/confirm-dialog';
import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Save } from 'lucide-react';
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
  initialStaffId?: string | null;
  existingGoals: ExistingGoal[];
}

export function GoalsManager({ staff, currentYear, currentMonth, initialStaffId, existingGoals }: GoalsManagerProps) {
  const [, startTransition] = useTransition();
  const router = useRouter();
  const [staffId, setStaffId] = useState(initialStaffId ?? '');

  useEffect(() => {
    if (initialStaffId !== null && initialStaffId !== undefined) {
      setStaffId(initialStaffId);
    }
  }, [initialStaffId]);
  const [revenueTarget, setRevenueTarget] = useState('');
  const [apptTarget, setApptTarget] = useState('');
  const [ticketTarget, setTicketTarget] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const confirmDialog = useConfirm();

  async function handleSave() {
    const numericRevenue = Number(revenueTarget.replace(',', '.'));
    if (!numericRevenue || numericRevenue <= 0) {
      toast.error('Informe uma meta de faturamento válida.');
      return;
    }
    setIsLoading(true);
    try {
      const result = await upsertGoal({
        staff_id: staffId || null,
        period_type: 'monthly',
        year: currentYear,
        month: currentMonth,
        revenue_target: numericRevenue,
        appointments_target: apptTarget ? Number(apptTarget) : undefined,
        avg_ticket_target: ticketTarget ? Number(ticketTarget.replace(',', '.')) : undefined,
      });
      if (result.ok) {
        toast.success('Meta salva com sucesso!');
        setRevenueTarget('');
        setApptTarget('');
        setTicketTarget('');
        setStaffId('');
        startTransition(() => router.refresh());
      } else {
        toast.error(result.error ?? 'Erro ao salvar meta.');
      }
    } catch (err) {
      toast.error('Erro inesperado ao salvar meta.');
      console.error('upsertGoal error:', err);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDelete(goalId: string) {
    if (!(await confirmDialog({ title: 'Remover esta meta?', danger: true }))) return;
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
    <section id="form-meta" className="card p-6 space-y-4 scroll-mt-24">
      <h2
        className="text-lg font-semibold text-fg"
        style={{ fontFamily: 'var(--font-playfair), serif' }}
      >
        Definir ou Atualizar Meta
      </h2>
      <p className="text-[11px] text-fg-subtle">
        Defina uma meta mensal de faturamento. &quot;Toda a barbearia&quot; cria meta
        consolidada. Selecionar um profissional cria meta individual.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label className="label">Aplica a</label>
          <select value={staffId} onChange={(e) => setStaffId(e.target.value)} className="input">
            <option value="">Toda a barbearia</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>{s.display_name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Meta de faturamento (R$) *</label>
          <input
            type="number" step="0.01" min="0" placeholder="Ex: 15000.00"
            value={revenueTarget} onChange={(e) => setRevenueTarget(e.target.value)}
            className="input"
          />
        </div>
        <div>
          <label className="label">Meta de atendimentos (opcional)</label>
          <input
            type="number" min="0" placeholder="Ex: 75"
            value={apptTarget} onChange={(e) => setApptTarget(e.target.value)}
            className="input"
          />
        </div>
        <div>
          <label className="label">Meta de ticket médio (opcional)</label>
          <input
            type="number" step="0.01" min="0" placeholder="Ex: 100.00"
            value={ticketTarget} onChange={(e) => setTicketTarget(e.target.value)}
            className="input"
          />
        </div>
        <div className="flex items-end">
          <button
            type="button" onClick={handleSave} disabled={isLoading}
            className="btn-gold-shimmer flex items-center gap-2 w-full justify-center"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>Salvar meta</span>
          </button>
        </div>
      </div>

      {existingGoals.length > 0 && (
        <div className="pt-4 border-t border-border/60 space-y-2">
          <p className="text-[10px] uppercase tracking-wider text-fg-dim">Metas definidas neste mês</p>
          {existingGoals.map((g) => (
            <div key={g.id} className="flex items-center justify-between gap-3 p-3 rounded-md bg-bg-elevated border border-border/60">
              <div>
                <p className="text-sm text-fg">
                  {g.staff_name ?? <span className="text-gold">Toda a barbearia</span>}
                </p>
                <p className="text-xs text-fg-subtle">
                  Meta: <strong>{formatCurrency(g.revenue_target)}</strong>
                </p>
              </div>
              <button
                type="button" onClick={() => handleDelete(g.id)} disabled={deletingId === g.id}
                className="text-xs text-danger hover:bg-danger/10 px-3 py-1.5 rounded-md transition-colors"
              >
                {deletingId === g.id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Remover'}
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
