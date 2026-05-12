'use client';

import { useState, useTransition } from 'react';
import { Loader2, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { updateBusinessHours, type BusinessHours } from '../actions';

interface BusinessHoursFormProps {
  initialHours: BusinessHours;
}

const DAYS = [
  { key: 'monday' as const, label: 'Segunda-feira', short: 'SEG' },
  { key: 'tuesday' as const, label: 'Terça-feira', short: 'TER' },
  { key: 'wednesday' as const, label: 'Quarta-feira', short: 'QUA' },
  { key: 'thursday' as const, label: 'Quinta-feira', short: 'QUI' },
  { key: 'friday' as const, label: 'Sexta-feira', short: 'SEX' },
  { key: 'saturday' as const, label: 'Sábado', short: 'SAB' },
  { key: 'sunday' as const, label: 'Domingo', short: 'DOM' },
];

export function BusinessHoursForm({ initialHours }: BusinessHoursFormProps) {
  const router = useRouter();
  const [hours, setHours] = useState<BusinessHours>(initialHours);
  const [isPending, startTransition] = useTransition();
  const [isDirty, setIsDirty] = useState(false);

  function updateDay(
    day: keyof BusinessHours,
    field: 'open' | 'close' | 'closed',
    value: string | boolean
  ) {
    setHours((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        [field]: value,
      },
    }));
    setIsDirty(true);
  }

  async function handleSave() {
    const result = await updateBusinessHours(hours);

    if (result.ok) {
      toast.success('Horários atualizados!');
      setIsDirty(false);
      startTransition(() => router.refresh());
    } else {
      toast.error(result.error ?? 'Erro ao salvar');
    }
  }

  function applyToAll() {
    const monday = hours.monday;
    setHours((prev) => ({
      monday: prev.monday,
      tuesday: { ...monday },
      wednesday: { ...monday },
      thursday: { ...monday },
      friday: { ...monday },
      saturday: { ...monday },
      sunday: prev.sunday, // domingo mantém
    }));
    setIsDirty(true);
    toast.info('Horários da segunda copiados para os outros dias úteis');
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-2">
        {DAYS.map((day) => {
          const dayHours = hours[day.key];
          return (
            <div
              key={day.key}
              className={cn(
                'flex items-center gap-3 p-3 rounded-md border transition-colors',
                dayHours.closed
                  ? 'border-border bg-bg-elevated opacity-60'
                  : 'border-border bg-bg-elevated'
              )}
            >
              {/* Label do dia */}
              <div className="w-32 flex-shrink-0">
                <p className="text-sm font-medium text-fg">{day.label}</p>
                <p className="text-[10px] text-fg-dim tracking-widest">{day.short}</p>
              </div>

              {/* Toggle aberto/fechado */}
              <label className="flex items-center gap-2 cursor-pointer flex-shrink-0">
                <input
                  type="checkbox"
                  checked={!dayHours.closed}
                  onChange={(e) => updateDay(day.key, 'closed', !e.target.checked)}
                  className="w-4 h-4 accent-gold"
                />
                <span
                  className={cn(
                    'text-xs uppercase tracking-wider font-semibold',
                    dayHours.closed ? 'text-fg-subtle' : 'text-success'
                  )}
                >
                  {dayHours.closed ? 'Fechado' : 'Aberto'}
                </span>
              </label>

              {/* Inputs de horário */}
              <div className="flex items-center gap-2 ml-auto">
                <input
                  type="time"
                  value={dayHours.open}
                  onChange={(e) => updateDay(day.key, 'open', e.target.value)}
                  disabled={dayHours.closed}
                  className="input text-sm w-28"
                />
                <span className="text-fg-subtle text-xs">até</span>
                <input
                  type="time"
                  value={dayHours.close}
                  onChange={(e) => updateDay(day.key, 'close', e.target.value)}
                  disabled={dayHours.closed}
                  className="input text-sm w-28"
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Ações */}
      <div className="flex items-center justify-between pt-3 border-t border-border/40">
        <button
          type="button"
          onClick={applyToAll}
          className="btn-ghost text-xs"
        >
          Aplicar segunda-feira a todos os dias úteis
        </button>

        <button
          type="button"
          onClick={handleSave}
          disabled={!isDirty || isPending}
          className="btn-primary text-sm flex items-center gap-2"
        >
          {isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Check className="w-4 h-4" />
          )}
          <span>Salvar horários</span>
        </button>
      </div>
    </div>
  );
}
