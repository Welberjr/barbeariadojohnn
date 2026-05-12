'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  X,
  Phone,
  User,
  Scissors,
  Clock,
  Calendar,
  Check,
  XCircle,
  PlayCircle,
  CheckCircle2,
  Trash2,
  Loader2,
  FileText,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn, formatCurrency } from '@/lib/utils';
import {
  updateAppointmentStatus,
  deleteAppointment,
} from '../actions';

interface Appointment {
  id: string;
  customer_id: string;
  staff_id: string;
  service_id: string | null;
  start_at: string;
  end_at: string;
  status: string;
  notes: string | null;
  customers: { full_name: string; phone: string | null } | null;
  services: {
    name: string;
    base_price: number;
    base_duration_minutes: number;
  } | null;
}

interface AppointmentDrawerProps {
  appointment: Appointment;
  onClose: () => void;
}

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bgColor: string }
> = {
  scheduled: {
    label: 'Agendado',
    color: '#D4A04F',
    bgColor: 'rgba(212, 160, 79, 0.15)',
  },
  confirmed: {
    label: 'Confirmado',
    color: '#22c55e',
    bgColor: 'rgba(34, 197, 94, 0.15)',
  },
  in_progress: {
    label: 'Em atendimento',
    color: '#3b82f6',
    bgColor: 'rgba(59, 130, 246, 0.15)',
  },
  completed: {
    label: 'Concluído',
    color: '#94a3b8',
    bgColor: 'rgba(148, 163, 184, 0.15)',
  },
  cancelled: {
    label: 'Cancelado',
    color: '#ef4444',
    bgColor: 'rgba(239, 68, 68, 0.10)',
  },
  no_show: {
    label: 'Não compareceu',
    color: '#fb923c',
    bgColor: 'rgba(251, 146, 60, 0.10)',
  },
};

export function AppointmentDrawer({
  appointment,
  onClose,
}: AppointmentDrawerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const startTime = new Date(appointment.start_at).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const endTime = new Date(appointment.end_at).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const dateStr = new Date(appointment.start_at).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  });

  const statusConfig =
    STATUS_CONFIG[appointment.status] ?? STATUS_CONFIG.scheduled;

  async function handleStatusChange(
    newStatus: keyof typeof STATUS_CONFIG
  ) {
    const result = await updateAppointmentStatus(
      appointment.id,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      newStatus as any
    );

    if (result.ok) {
      toast.success(`Status alterado para ${STATUS_CONFIG[newStatus].label}`);
      startTransition(() => {
        router.refresh();
        onClose();
      });
    } else {
      toast.error(result.error ?? 'Erro');
    }
  }

  async function handleDelete() {
    if (!confirm(`Cancelar este agendamento permanentemente? Esta ação não pode ser desfeita.`))
      return;

    const result = await deleteAppointment(appointment.id);
    if (result.ok) {
      toast.success('Agendamento removido!');
      startTransition(() => {
        router.refresh();
        onClose();
      });
    } else {
      toast.error(result.error ?? 'Erro');
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 z-40 animate-fade-in"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 w-full max-w-md bg-bg border-l border-border z-50 shadow-2xl overflow-y-auto animate-slide-in-right">
        {/* Header */}
        <div className="sticky top-0 bg-bg border-b border-border p-5 flex items-center justify-between z-10">
          <div>
            <p className="text-[10px] text-gold tracking-widest uppercase font-semibold">
              Agendamento
            </p>
            <h2
              className="text-lg font-bold text-fg"
              style={{ fontFamily: 'var(--font-playfair), serif' }}
            >
              Detalhes
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-md hover:bg-bg-elevated text-fg-muted hover:text-fg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Status badge */}
          <div
            className="px-4 py-2 rounded-md inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-wider"
            style={{
              backgroundColor: statusConfig.bgColor,
              color: statusConfig.color,
            }}
          >
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: statusConfig.color }}
            />
            {statusConfig.label}
          </div>

          {/* Cliente */}
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <User className="w-4 h-4 text-gold flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] text-fg-dim uppercase tracking-wider">
                  Cliente
                </p>
                <p className="text-base font-semibold text-fg">
                  {appointment.customers?.full_name ?? 'Sem cliente'}
                </p>
              </div>
            </div>

            {appointment.customers?.phone && (
              <div className="flex items-start gap-3">
                <Phone className="w-4 h-4 text-gold flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-[10px] text-fg-dim uppercase tracking-wider">
                    Telefone
                  </p>
                  <p className="text-sm text-fg">
                    {appointment.customers.phone}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Linha divisória */}
          <div className="h-px bg-border" />

          {/* Serviço */}
          {appointment.services && (
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Scissors className="w-4 h-4 text-gold flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-[10px] text-fg-dim uppercase tracking-wider">
                    Serviço
                  </p>
                  <p className="text-sm font-semibold text-fg">
                    {appointment.services.name}
                  </p>
                  <p className="text-sm text-gold font-bold mt-1">
                    {formatCurrency(Number(appointment.services.base_price))}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Horário */}
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <Calendar className="w-4 h-4 text-gold flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] text-fg-dim uppercase tracking-wider">
                  Data
                </p>
                <p className="text-sm text-fg capitalize">{dateStr}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Clock className="w-4 h-4 text-gold flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] text-fg-dim uppercase tracking-wider">
                  Horário
                </p>
                <p className="text-sm text-fg">
                  {startTime} → {endTime}
                </p>
              </div>
            </div>
          </div>

          {/* Notas */}
          {appointment.notes && (
            <>
              <div className="h-px bg-border" />
              <div className="flex items-start gap-3">
                <FileText className="w-4 h-4 text-gold flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-[10px] text-fg-dim uppercase tracking-wider">
                    Observações
                  </p>
                  <p className="text-sm text-fg-muted whitespace-pre-wrap">
                    {appointment.notes}
                  </p>
                </div>
              </div>
            </>
          )}

          {/* Linha divisória */}
          <div className="h-px bg-border" />

          {/* Ações de status */}
          <div className="space-y-3">
            <p className="text-[10px] text-fg-dim uppercase tracking-wider font-semibold">
              Alterar status
            </p>

            <div className="grid grid-cols-2 gap-2">
              {appointment.status === 'scheduled' && (
                <button
                  type="button"
                  onClick={() => handleStatusChange('confirmed')}
                  disabled={isPending}
                  className="btn-ghost text-sm flex items-center justify-center gap-1.5 py-2 hover:bg-success/10 hover:text-success"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Confirmar</span>
                </button>
              )}

              {(appointment.status === 'scheduled' ||
                appointment.status === 'confirmed') && (
                <button
                  type="button"
                  onClick={() => handleStatusChange('in_progress')}
                  disabled={isPending}
                  className="btn-ghost text-sm flex items-center justify-center gap-1.5 py-2 hover:bg-blue-500/10 hover:text-blue-400"
                >
                  <PlayCircle className="w-3.5 h-3.5" />
                  <span>Iniciar</span>
                </button>
              )}

              {appointment.status === 'in_progress' && (
                <button
                  type="button"
                  onClick={() => handleStatusChange('completed')}
                  disabled={isPending}
                  className="btn-ghost text-sm flex items-center justify-center gap-1.5 py-2 hover:bg-gold/10 hover:text-gold col-span-2"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Concluir atendimento</span>
                </button>
              )}

              {appointment.status !== 'cancelled' &&
                appointment.status !== 'completed' && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleStatusChange('cancelled')}
                      disabled={isPending}
                      className="btn-ghost text-sm flex items-center justify-center gap-1.5 py-2 hover:bg-danger/10 hover:text-danger"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Cancelar</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStatusChange('no_show')}
                      disabled={isPending}
                      className="btn-ghost text-sm flex items-center justify-center gap-1.5 py-2 hover:bg-orange-500/10 hover:text-orange-400"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Não veio</span>
                    </button>
                  </>
                )}
            </div>
          </div>

          {/* Deletar */}
          <div className="pt-4">
            <button
              type="button"
              onClick={handleDelete}
              disabled={isPending}
              className={cn(
                'w-full text-xs text-fg-subtle hover:text-danger transition-colors flex items-center justify-center gap-1.5 py-2'
              )}
            >
              {isPending ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Trash2 className="w-3 h-3" />
              )}
              <span>Remover permanentemente</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
