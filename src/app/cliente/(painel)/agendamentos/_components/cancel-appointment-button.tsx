'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, X } from 'lucide-react';
import { cancelCustomerAppointment } from '@/app/cliente/actions';

const CANCEL_MIN_HOURS = 2;

interface CancelAppointmentButtonProps {
  appointmentId: string;
  startAt: string;
}

export function CancelAppointmentButton({
  appointmentId,
  startAt,
}: CancelAppointmentButtonProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);

  const canCancel =
    new Date(startAt).getTime() - Date.now() >= CANCEL_MIN_HOURS * 3600 * 1000;

  if (!canCancel) return null;

  async function handleCancel() {
    if (!confirm('Cancelar este agendamento?')) return;
    setBusy(true);
    const result = await cancelCustomerAppointment(appointmentId);
    setBusy(false);

    if (result.ok) {
      toast.success('Agendamento cancelado');
      startTransition(() => router.refresh());
    } else {
      toast.error(result.error ?? 'Erro ao cancelar');
    }
  }

  return (
    <button
      type="button"
      onClick={handleCancel}
      disabled={busy}
      className="flex-shrink-0 p-2 rounded-md text-fg-subtle hover:text-danger hover:bg-danger/10 transition-colors"
      title="Cancelar agendamento"
      aria-label="Cancelar agendamento"
    >
      {busy ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <X className="w-3.5 h-3.5" />
      )}
    </button>
  );
}
