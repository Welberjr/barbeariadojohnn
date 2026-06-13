'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { X, Scissors, Clock, User, CalendarPlus, Trash2, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { cancelCustomerAppointment } from '@/app/cliente/actions';
import { useConfirm } from '@/components/confirm-dialog';

interface Appointment {
  id: string;
  start_at: string;
  status: string;
  staff: { display_name: string } | null;
  appointment_services: { services: { name: string } | null }[];
}

interface AppointmentModalProps {
  appointment: Appointment;
  onClose: () => void;
}

const CANCEL_MIN_HOURS = 2;

function fmtFull(iso: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'long', day: '2-digit', month: 'long',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso));
}

export function AppointmentModal({ appointment, onClose }: AppointmentModalProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const confirmDialog = useConfirm();

  const svcName = appointment.appointment_services
    .map((s) => s.services?.name).filter(Boolean).join(' + ') || 'Atendimento';

  const canCancel =
    new Date(appointment.start_at).getTime() - Date.now() >= CANCEL_MIN_HOURS * 3600000;

  const canReschedule =
    new Date(appointment.start_at).getTime() - Date.now() >= CANCEL_MIN_HOURS * 3600000;

  async function handleCancel() {
    if (!(await confirmDialog({
      title: 'Cancelar este agendamento?',
      description: 'Esta ação não pode ser desfeita. Cancele com pelo menos 2h de antecedência.',
      danger: true,
      confirmLabel: 'Sim, cancelar',
    }))) return;

    setBusy(true);
    const result = await cancelCustomerAppointment(appointment.id);
    setBusy(false);

    if (result.ok) {
      toast.success('Agendamento cancelado');
      onClose();
      startTransition(() => router.refresh());
    } else {
      toast.error(result.error ?? 'Erro ao cancelar');
    }
  }

  function handleReschedule() {
    onClose();
    router.push('/cliente/agendar');
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-sm bg-bg border border-border/60 rounded-t-2xl sm:rounded-2xl flex flex-col"
        style={{ animation: 'slideUp 0.25s ease-out', maxHeight: '90vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle mobile */}
        <div className="sm:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
          <h3 className="text-base font-bold text-fg" style={{ fontFamily: 'var(--font-playfair), serif' }}>
            Seu agendamento
          </h3>
          <button type="button" onClick={onClose} className="text-fg-subtle hover:text-fg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Detalhes */}
        <div className="px-5 py-4 space-y-3 overflow-y-auto flex-1">
          <div className="card p-4 space-y-2.5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-md bg-gold/10 text-gold flex items-center justify-center flex-shrink-0">
                <Scissors className="w-4 h-4" />
              </div>
              <p className="text-base font-semibold text-fg">{svcName}</p>
            </div>
            <div className="space-y-1.5 pl-10">
              <div className="flex items-center gap-2 text-sm text-fg-muted">
                <Clock className="w-3.5 h-3.5 text-gold flex-shrink-0" />
                <span>{fmtFull(appointment.start_at)}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-fg-muted">
                <User className="w-3.5 h-3.5 text-gold flex-shrink-0" />
                <span>{appointment.staff?.display_name ?? '—'}</span>
              </div>
            </div>
          </div>

          {!canCancel && (
            <p className="text-[11px] text-fg-subtle text-center px-2">
              Cancelamentos só são possíveis com 2h ou mais de antecedência.
            </p>
          )}
        </div>

        {/* Acoes */}
        <div className="px-5 pb-safe-6 space-y-2 flex-shrink-0" style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}>
          {canReschedule && (
            <button
              type="button"
              onClick={handleReschedule}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold bg-gold/10 text-gold border border-gold/30 hover:bg-gold/20 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Reagendar (novo horário)
            </button>
          )}
          {canCancel && (
            <button
              type="button"
              onClick={handleCancel}
              disabled={busy}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-danger border border-danger/30 bg-danger/5 hover:bg-danger/10 transition-colors disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
              {busy ? 'Cancelando...' : 'Cancelar agendamento'}
            </button>
          )}
          <button
            type="button"
            onClick={() => { onClose(); router.push('/cliente/agendar'); }}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold btn-gold-shimmer"
          >
            <CalendarPlus className="w-4 h-4" />
            Agendar novo horário
          </button>
        </div>
      </div>
    </div>
  );
}