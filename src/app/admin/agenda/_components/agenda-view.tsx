'use client';

import { useState, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Plus,
  CalendarOff,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { AppointmentDrawer } from './appointment-drawer';
import { NewAppointmentDrawer } from './new-appointment-drawer';

interface Staff {
  id: string;
  display_name: string;
  role: string;
}

interface Customer {
  id: string;
  full_name: string;
  phone: string | null;
}

interface Service {
  id: string;
  name: string;
  base_price: number;
  base_duration_minutes: number;
  category: string | null;
}

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

interface DayOff {
  staff_id: string | null;
  start_date: string;
  end_date: string | null;
  reason: string | null;
  type: string | null;
}

interface DayHours {
  open: string;
  close: string;
  closed: boolean;
}

interface BusinessHours {
  monday: DayHours;
  tuesday: DayHours;
  wednesday: DayHours;
  thursday: DayHours;
  friday: DayHours;
  saturday: DayHours;
  sunday: DayHours;
}

interface AgendaViewProps {
  selectedDate: string; // YYYY-MM-DD
  staff: Staff[];
  appointments: Appointment[];
  businessHours: BusinessHours | null;
  daysOff: DayOff[];
  customers: Customer[];
  services: Service[];
}

// Slots de 30 min entre 8h e 22h
const SLOT_HEIGHT = 60; // px por hora
const HOUR_HEIGHT = 60;

function timeToMinutes(time: string) {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

const DAY_NAMES: Record<number, keyof BusinessHours> = {
  0: 'sunday',
  1: 'monday',
  2: 'tuesday',
  3: 'wednesday',
  4: 'thursday',
  5: 'friday',
  6: 'saturday',
};

const STATUS_COLORS: Record<
  string,
  { bg: string; border: string; text: string; label: string }
> = {
  scheduled: {
    bg: 'rgba(212, 160, 79, 0.15)',
    border: '#D4A04F',
    text: '#D4A04F',
    label: 'Agendado',
  },
  confirmed: {
    bg: 'rgba(34, 197, 94, 0.15)',
    border: '#22c55e',
    text: '#22c55e',
    label: 'Confirmado',
  },
  in_progress: {
    bg: 'rgba(59, 130, 246, 0.15)',
    border: '#3b82f6',
    text: '#3b82f6',
    label: 'Em atendimento',
  },
  completed: {
    bg: 'rgba(148, 163, 184, 0.15)',
    border: '#94a3b8',
    text: '#94a3b8',
    label: 'Concluído',
  },
  cancelled: {
    bg: 'rgba(239, 68, 68, 0.10)',
    border: '#ef4444',
    text: '#ef4444',
    label: 'Cancelado',
  },
  no_show: {
    bg: 'rgba(251, 146, 60, 0.10)',
    border: '#fb923c',
    text: '#fb923c',
    label: 'Não compareceu',
  },
};

export function AgendaView({
  selectedDate,
  staff,
  appointments,
  businessHours,
  daysOff,
  customers,
  services,
}: AgendaViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [openApt, setOpenApt] = useState<Appointment | null>(null);
  const [newAptContext, setNewAptContext] = useState<{
    staffId: string;
    startTime: string; // HH:MM
  } | null>(null);

  // Calcular hora de início/fim do dia
  const date = new Date(selectedDate + 'T00:00:00');
  const dayOfWeek = date.getDay();
  const dayHours = businessHours?.[DAY_NAMES[dayOfWeek]];

  const isBarbershopClosed = dayHours?.closed ?? false;
  const startHour = dayHours ? parseInt(dayHours.open.split(':')[0]) : 9;
  const endHour = dayHours ? parseInt(dayHours.close.split(':')[0]) + 1 : 20;
  const totalHours = endHour - startHour;

  // Folgas que afetam cada profissional
  const staffOnDayOff = useMemo(() => {
    const map = new Map<string, DayOff>();
    daysOff.forEach((d) => {
      if (d.staff_id) {
        map.set(d.staff_id, d);
      }
    });
    return map;
  }, [daysOff]);

  // Folga da barbearia inteira
  const barbershopDayOff = daysOff.find((d) => !d.staff_id);

  // Navegação de datas
  function changeDate(delta: number) {
    const d = new Date(selectedDate + 'T00:00:00');
    d.setDate(d.getDate() + delta);
    const newDate = d.toISOString().split('T')[0];
    const params = new URLSearchParams(searchParams.toString());
    params.set('date', newDate);
    router.push(`/admin/agenda?${params.toString()}`);
  }

  function goToToday() {
    const today = new Date().toISOString().split('T')[0];
    router.push(`/admin/agenda?date=${today}`);
  }

  // Formatação da data atual
  const dateFormatted = date.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  // Estatísticas do dia
  const stats = useMemo(() => {
    const total = appointments.length;
    const confirmed = appointments.filter(
      (a) => a.status === 'confirmed' || a.status === 'in_progress'
    ).length;
    const completed = appointments.filter((a) => a.status === 'completed')
      .length;
    return { total, confirmed, completed };
  }, [appointments]);

  // Agrupar appointments por profissional
  const appointmentsByStaff = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    staff.forEach((s) => map.set(s.id, []));
    appointments.forEach((a) => {
      const arr = map.get(a.staff_id) ?? [];
      arr.push(a);
      map.set(a.staff_id, arr);
    });
    return map;
  }, [appointments, staff]);

  // Renderizar horários (linhas horizontais)
  const hourLines = Array.from({ length: totalHours + 1 }, (_, i) => startHour + i);

  // Calcular posição vertical de um appointment
  function getAptPosition(apt: Appointment) {
    const start = new Date(apt.start_at);
    const end = new Date(apt.end_at);
    const startMinFromDayStart =
      start.getHours() * 60 + start.getMinutes() - startHour * 60;
    const durationMin = (end.getTime() - start.getTime()) / 60000;
    return {
      top: (startMinFromDayStart / 60) * HOUR_HEIGHT,
      height: Math.max((durationMin / 60) * HOUR_HEIGHT, 32),
    };
  }

  function handleSlotClick(staffId: string, hour: number, half: 0 | 30) {
    const hh = String(hour).padStart(2, '0');
    const mm = String(half).padStart(2, '0');
    setNewAptContext({
      staffId,
      startTime: `${hh}:${mm}`,
    });
  }

  return (
    <div className="space-y-4">
      {/* ============= HEADER ============= */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <p className="text-[10px] text-gold tracking-[0.3em] uppercase font-semibold mb-1">
            Gestão
          </p>
          <h1
            className="text-2xl md:text-3xl font-bold text-fg"
            style={{ fontFamily: 'var(--font-playfair), serif' }}
          >
            Agenda
          </h1>
          <p className="text-sm text-fg-muted mt-1 capitalize">
            {dateFormatted}
          </p>
        </div>

        {/* Controles de navegação */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => changeDate(-1)}
            className="btn-ghost p-2 rounded-md"
            title="Dia anterior"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <button type="button" onClick={goToToday} className="btn-ghost text-sm">
            Hoje
          </button>

          <input
            type="date"
            value={selectedDate}
            onChange={(e) => {
              router.push(`/admin/agenda?date=${e.target.value}`);
            }}
            className="input text-sm w-44"
          />

          <button
            type="button"
            onClick={() => changeDate(1)}
            className="btn-ghost p-2 rounded-md"
            title="Próximo dia"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => {
              if (staff.length > 0) {
                setNewAptContext({
                  staffId: staff[0].id,
                  startTime: '09:00',
                });
              }
            }}
            className="btn-primary text-sm flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Novo agendamento</span>
          </button>
        </div>
      </div>

      {/* ============= STATS RAPIDAS ============= */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="card-premium p-4">
          <p className="text-[10px] text-fg-dim tracking-widest uppercase">
            Total do dia
          </p>
          <p
            className="text-2xl font-bold text-fg mt-1"
            style={{ fontFamily: 'var(--font-playfair), serif' }}
          >
            {stats.total}
          </p>
        </div>
        <div className="card-premium p-4">
          <p className="text-[10px] text-fg-dim tracking-widest uppercase">
            Confirmados
          </p>
          <p
            className="text-2xl font-bold text-success mt-1"
            style={{ fontFamily: 'var(--font-playfair), serif' }}
          >
            {stats.confirmed}
          </p>
        </div>
        <div className="card-premium p-4">
          <p className="text-[10px] text-fg-dim tracking-widest uppercase">
            Concluídos
          </p>
          <p
            className="text-2xl font-bold text-gold mt-1"
            style={{ fontFamily: 'var(--font-playfair), serif' }}
          >
            {stats.completed}
          </p>
        </div>
      </div>

      {/* ============= BANNERS ============= */}
      {isBarbershopClosed && !barbershopDayOff && (
        <div className="card p-4 border-l-4 border-l-warning bg-warning/5">
          <div className="flex items-center gap-2">
            <CalendarOff className="w-4 h-4 text-warning" />
            <p className="text-sm font-medium text-warning">
              Barbearia fechada neste dia da semana
            </p>
          </div>
        </div>
      )}

      {barbershopDayOff && (
        <div className="card p-4 border-l-4 border-l-danger bg-danger/5">
          <div className="flex items-center gap-2">
            <CalendarOff className="w-4 h-4 text-danger" />
            <div>
              <p className="text-sm font-medium text-danger">
                Barbearia fechada — {barbershopDayOff.type ?? 'folga'}
              </p>
              {barbershopDayOff.reason && (
                <p className="text-xs text-fg-muted mt-0.5">
                  {barbershopDayOff.reason}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============= CALENDÁRIO ============= */}
      {staff.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-fg-muted">
            Nenhum profissional cadastrado. Cadastre profissionais em{' '}
            <a href="/admin/profissionais" className="text-gold hover:underline">
              Profissionais
            </a>
            .
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <div
              className="flex"
              style={{ minWidth: `${100 + staff.length * 180}px` }}
            >
              {/* Coluna de horas (sticky left) */}
              <div className="w-[100px] flex-shrink-0 sticky left-0 bg-bg-surface z-10 border-r border-border">
                {/* Header */}
                <div className="h-14 border-b border-border flex items-center justify-center">
                  <span className="text-[10px] text-fg-dim tracking-widest uppercase">
                    Horário
                  </span>
                </div>
                {/* Hours */}
                <div className="relative">
                  {hourLines.map((h) => (
                    <div
                      key={h}
                      className="border-b border-border/40 flex items-start justify-end pr-3 pt-1"
                      style={{ height: `${HOUR_HEIGHT}px` }}
                    >
                      <span className="text-[11px] text-fg-subtle font-mono">
                        {String(h).padStart(2, '0')}:00
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Colunas de profissionais */}
              {staff.map((s) => {
                const aptList = appointmentsByStaff.get(s.id) ?? [];
                const staffOff = staffOnDayOff.get(s.id);

                return (
                  <div
                    key={s.id}
                    className="flex-1 min-w-[180px] border-r border-border last:border-r-0 relative"
                  >
                    {/* Header do profissional */}
                    <div className="h-14 border-b border-border p-3 flex items-center gap-2 bg-bg-elevated">
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-bg flex-shrink-0"
                        style={{
                          background:
                            'linear-gradient(135deg, #D4A04F 0%, #F5C518 100%)',
                        }}
                      >
                        {s.display_name
                          .split(' ')
                          .map((n) => n[0])
                          .join('')
                          .slice(0, 2)
                          .toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-fg truncate">
                          {s.display_name}
                        </p>
                        <p className="text-[9px] uppercase tracking-wider text-fg-dim">
                          {s.role}
                        </p>
                      </div>
                    </div>

                    {/* Grid de horários */}
                    <div
                      className="relative"
                      style={{ height: `${totalHours * HOUR_HEIGHT}px` }}
                    >
                      {/* Overlay de folga */}
                      {(staffOff || barbershopDayOff || isBarbershopClosed) && (
                        <div
                          className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none"
                          style={{
                            background:
                              'repeating-linear-gradient(45deg, rgba(239, 68, 68, 0.04), rgba(239, 68, 68, 0.04) 8px, rgba(239, 68, 68, 0.08) 8px, rgba(239, 68, 68, 0.08) 16px)',
                          }}
                        >
                          <div className="text-center px-4">
                            <CalendarOff className="w-6 h-6 text-danger mx-auto mb-1 opacity-60" />
                            <p className="text-xs text-danger font-medium">
                              {staffOff
                                ? `Em ${staffOff.type ?? 'folga'}`
                                : barbershopDayOff
                                ? 'Barbearia fechada'
                                : 'Fora do horário'}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Linhas horárias clicáveis */}
                      {hourLines.slice(0, -1).map((h) => (
                        <div
                          key={h}
                          className="border-b border-border/40 relative"
                          style={{ height: `${HOUR_HEIGHT}px` }}
                        >
                          {/* Slot inteira hora */}
                          <button
                            type="button"
                            onClick={() => handleSlotClick(s.id, h, 0)}
                            className="absolute inset-x-0 top-0 h-1/2 hover:bg-gold/5 transition-colors group cursor-pointer"
                          >
                            <span className="opacity-0 group-hover:opacity-100 text-[10px] text-gold absolute top-1 left-1 transition-opacity">
                              + {String(h).padStart(2, '0')}:00
                            </span>
                          </button>
                          {/* Slot meia hora */}
                          <button
                            type="button"
                            onClick={() => handleSlotClick(s.id, h, 30)}
                            className="absolute inset-x-0 bottom-0 h-1/2 hover:bg-gold/5 transition-colors group cursor-pointer border-t border-dashed border-border/20"
                          >
                            <span className="opacity-0 group-hover:opacity-100 text-[10px] text-gold absolute top-1 left-1 transition-opacity">
                              + {String(h).padStart(2, '0')}:30
                            </span>
                          </button>
                        </div>
                      ))}

                      {/* Appointments */}
                      {aptList.map((apt) => {
                        const pos = getAptPosition(apt);
                        const color =
                          STATUS_COLORS[apt.status] ?? STATUS_COLORS.scheduled;
                        const startTime = new Date(apt.start_at)
                          .toLocaleTimeString('pt-BR', {
                            hour: '2-digit',
                            minute: '2-digit',
                          });
                        const endTime = new Date(apt.end_at).toLocaleTimeString(
                          'pt-BR',
                          {
                            hour: '2-digit',
                            minute: '2-digit',
                          }
                        );

                        return (
                          <button
                            key={apt.id}
                            type="button"
                            onClick={() => setOpenApt(apt)}
                            className={cn(
                              'absolute inset-x-1 rounded-md p-2 text-left overflow-hidden hover:scale-[1.02] hover:shadow-lg transition-all border-l-2 z-20 cursor-pointer'
                            )}
                            style={{
                              top: `${pos.top}px`,
                              height: `${pos.height - 2}px`,
                              backgroundColor: color.bg,
                              borderLeftColor: color.border,
                            }}
                          >
                            <div className="text-[10px] font-mono opacity-70 mb-0.5" style={{ color: color.text }}>
                              {startTime} – {endTime}
                            </div>
                            <p
                              className="text-xs font-semibold truncate"
                              style={{ color: color.text }}
                            >
                              {apt.customers?.full_name ?? 'Cliente'}
                            </p>
                            {pos.height > 50 && apt.services?.name && (
                              <p
                                className="text-[10px] opacity-80 truncate mt-0.5"
                                style={{ color: color.text }}
                              >
                                {apt.services.name}
                              </p>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ============= DRAWERS ============= */}
      {openApt && (
        <AppointmentDrawer
          appointment={openApt}
          onClose={() => setOpenApt(null)}
        />
      )}

      {newAptContext && (
        <NewAppointmentDrawer
          context={newAptContext}
          selectedDate={selectedDate}
          staff={staff}
          customers={customers}
          services={services}
          onClose={() => setNewAptContext(null)}
        />
      )}
    </div>
  );
}
