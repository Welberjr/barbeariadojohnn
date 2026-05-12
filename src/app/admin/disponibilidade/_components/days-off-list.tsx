'use client';

import { useState, useTransition } from 'react';
import { Plus, Trash2, Loader2, CalendarOff, Users, X } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { createDayOff, deleteDayOff } from '../actions';

interface DayOffRow {
  id: string;
  staff_id: string | null;
  start_date: string;
  end_date: string | null;
  reason: string | null;
  type: string | null;
  staff?: { display_name: string } | null;
}

interface StaffOption {
  id: string;
  display_name: string;
  role: string;
}

interface DaysOffListProps {
  daysOff: DayOffRow[];
  availableStaff: StaffOption[];
}

const TYPE_LABELS: Record<string, string> = {
  day_off: 'Folga',
  vacation: 'Férias',
  holiday: 'Feriado',
  block: 'Bloqueio',
  sick: 'Atestado',
};

export function DaysOffList({ daysOff, availableStaff }: DaysOffListProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    staff_id: 'all',
    start_date: '',
    end_date: '',
    reason: '',
    type: 'day_off',
  });

  function formatDate(iso: string | null) {
    if (!iso) return '';
    const [y, m, d] = iso.split('T')[0].split('-');
    return `${d}/${m}/${y}`;
  }

  async function handleAdd() {
    if (!form.start_date) {
      toast.error('Informe a data de início');
      return;
    }

    const result = await createDayOff({
      staff_id: form.staff_id === 'all' ? null : form.staff_id,
      start_date: form.start_date,
      end_date: form.end_date || form.start_date,
      reason: form.reason || null,
      type: form.type,
    });

    if (result.ok) {
      toast.success('Folga cadastrada!');
      setShowAdd(false);
      setForm({
        staff_id: 'all',
        start_date: '',
        end_date: '',
        reason: '',
        type: 'day_off',
      });
      startTransition(() => router.refresh());
    } else {
      toast.error(result.error ?? 'Erro ao cadastrar');
    }
  }

  async function handleDelete(id: string, label: string) {
    if (!confirm(`Remover "${label}"?`)) return;

    const result = await deleteDayOff(id);
    if (result.ok) {
      toast.success('Folga removida!');
      startTransition(() => router.refresh());
    } else {
      toast.error(result.error ?? 'Erro ao remover');
    }
  }

  return (
    <div className="space-y-3" id="nova-folga">
      {/* Form de adicionar */}
      {showAdd && (
        <div className="card-premium p-4 space-y-3 animate-fade-in">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gold tracking-wider uppercase font-semibold">
              Nova folga / bloqueio
            </p>
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="text-fg-subtle hover:text-fg"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="label text-[10px]">Quem</label>
              <select
                className="input text-sm"
                value={form.staff_id}
                onChange={(e) => setForm({ ...form, staff_id: e.target.value })}
              >
                <option value="all">🏪 Barbearia inteira (todos)</option>
                {availableStaff.map((s) => (
                  <option key={s.id} value={s.id}>
                    👤 {s.display_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label text-[10px]">Tipo</label>
              <select
                className="input text-sm"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
              >
                <option value="day_off">Folga</option>
                <option value="vacation">Férias</option>
                <option value="holiday">Feriado</option>
                <option value="block">Bloqueio</option>
                <option value="sick">Atestado</option>
              </select>
            </div>

            <div>
              <label className="label text-[10px]">Data início *</label>
              <input
                type="date"
                className="input text-sm"
                value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })}
              />
            </div>

            <div>
              <label className="label text-[10px]">
                Data fim (deixe vazio se for 1 dia só)
              </label>
              <input
                type="date"
                className="input text-sm"
                value={form.end_date}
                onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                min={form.start_date}
              />
            </div>

            <div className="md:col-span-2">
              <label className="label text-[10px]">Motivo (opcional)</label>
              <input
                type="text"
                placeholder="Ex: Viagem de família, Feriado nacional, etc."
                className="input text-sm"
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="btn-ghost text-sm"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleAdd}
              disabled={isPending}
              className="btn-primary text-sm flex items-center gap-1.5"
            >
              {isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Plus className="w-3.5 h-3.5" />
              )}
              <span>Cadastrar folga</span>
            </button>
          </div>
        </div>
      )}

      {!showAdd && (
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="w-full py-3 rounded-md border border-dashed border-border text-sm text-fg-muted hover:border-gold/40 hover:text-gold transition-colors flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>Adicionar folga, férias ou bloqueio</span>
        </button>
      )}

      {/* Lista de folgas */}
      {daysOff.length === 0 ? (
        <div className="text-center py-8 text-fg-subtle text-sm border border-dashed border-border rounded-md">
          <CalendarOff className="w-8 h-8 mx-auto mb-2 opacity-40" />
          Nenhuma folga ou bloqueio futuro.
        </div>
      ) : (
        <div className="space-y-2">
          {daysOff.map((row) => {
            const sameDay =
              !row.end_date || row.start_date === row.end_date;
            const label = sameDay
              ? formatDate(row.start_date)
              : `${formatDate(row.start_date)} → ${formatDate(row.end_date)}`;
            const typeLabel = TYPE_LABELS[row.type ?? 'day_off'] ?? row.type;

            return (
              <div
                key={row.id}
                className="card-premium p-3 flex items-center gap-3"
              >
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{
                    background: row.staff_id
                      ? 'rgba(212, 160, 79, 0.15)'
                      : 'rgba(245, 197, 24, 0.15)',
                  }}
                >
                  {row.staff_id ? (
                    <CalendarOff className="w-4 h-4 text-gold" />
                  ) : (
                    <Users className="w-4 h-4 text-gold-shimmer" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-fg">
                      {row.staff?.display_name ?? '🏪 Barbearia inteira'}
                    </p>
                    <span
                      className={cn(
                        'text-[9px] px-2 py-0.5 rounded-full uppercase tracking-wider font-semibold',
                        row.type === 'vacation' && 'bg-blue-500/10 text-blue-400',
                        row.type === 'holiday' && 'bg-purple-500/10 text-purple-400',
                        row.type === 'block' && 'bg-red-500/10 text-red-400',
                        row.type === 'sick' && 'bg-orange-500/10 text-orange-400',
                        (!row.type || row.type === 'day_off') &&
                          'bg-gold/10 text-gold'
                      )}
                    >
                      {typeLabel}
                    </span>
                  </div>
                  <p className="text-xs text-fg-muted mt-0.5">
                    {label}
                    {row.reason && (
                      <span className="ml-2 text-fg-dim">· {row.reason}</span>
                    )}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    handleDelete(
                      row.id,
                      `${row.staff?.display_name ?? 'Barbearia'} · ${label}`
                    )
                  }
                  className="p-2 rounded-md text-fg-muted hover:text-danger hover:bg-danger/10 transition-colors flex-shrink-0"
                  title="Remover"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
