'use client';

import { useState } from 'react';
import { Scissors, ChevronRight, CalendarPlus, Clock } from 'lucide-react';
import Link from 'next/link';
import { AppointmentModal } from './appointment-modal';

interface Appointment {
  id: string;
  start_at: string;
  status: string;
  staff: { display_name: string } | null;
  appointment_services: { services: { name: string } | null }[];
}

function fmtDateTime(iso: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'short', day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso));
}

export function UpcomingAppointments({ appointments }: { appointments: Appointment[] }) {
  const [selected, setSelected] = useState<Appointment | null>(null);

  if (!appointments.length) {
    return (
      <div className="card p-6 text-center space-y-3">
        <Clock className="w-6 h-6 text-fg-subtle mx-auto" />
        <p className="text-xs text-fg-muted">Nenhum agendamento marcado.</p>
        <Link href="/cliente/agendar" className="btn-gold-shimmer inline-flex items-center gap-2 px-4 py-2 text-sm">
          <CalendarPlus className="w-4 h-4" />
          Agendar agora
        </Link>
      </div>
    );
  }

  return (
    <>
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-fg-muted uppercase tracking-wider flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-gold" />
            Próximos
          </p>
          <Link href="/cliente/agendamentos" className="text-[11px] text-gold flex items-center gap-0.5">
            Ver todos <ChevronRight className="w-3 h-3" />
          </Link>
        </div>

        {appointments.map((a) => {
          const svc = a.appointment_services
            .map((s) => s.services?.name).filter(Boolean).join(' + ') || 'Atendimento';
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => setSelected(a)}
              className="w-full card px-4 py-3 flex items-center gap-3 hover:border-gold/40 transition-colors text-left"
            >
              <div className="w-9 h-9 rounded-md bg-gold/10 text-gold flex items-center justify-center flex-shrink-0">
                <Scissors className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-fg font-medium truncate">{svc}</p>
                <p className="text-[11px] text-fg-muted">
                  {fmtDateTime(a.start_at)} · {a.staff?.display_name ?? '—'}
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-fg-subtle flex-shrink-0" />
            </button>
          );
        })}
      </section>

      {selected && (
        <AppointmentModal
          appointment={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}