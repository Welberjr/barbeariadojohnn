'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Scissors,
  User,
  Calendar,
  Clock,
  Check,
  ChevronLeft,
  Loader2,
  Star,
  Crown,
  AlertTriangle,
} from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { getSlotsAction, bookAppointment } from '@/app/cliente/actions';

// ---------------------------------------------------------------------------

interface ServiceOption {
  id: string;
  name: string;
  description: string | null;
  category: string;
  base_price: number;
  base_duration_minutes: number;
}

interface StaffOption {
  id: string;
  display_name: string;
}

interface StaffServiceOverride {
  staff_id: string;
  service_id: string;
  custom_price: number | null;
  custom_duration_minutes: number | null;
  active: boolean;
}

interface DayOption {
  dateStr: string;
  dow: number;
  dayNum: string;
  weekdayShort: string;
  monthShort: string;
  isToday: boolean;
}

interface SubscriptionSummary {
  planName: string;
  allowedDays: number[];
  usesLeft: number;
  includedUses: number;
  isExpired: boolean;
  coveredServiceIds: string[];
}

interface SlotOption {
  time: string;
  startISO: string;
}

interface BookingWizardProps {
  services: ServiceOption[];
  staff: StaffOption[];
  staffServices: StaffServiceOverride[];
  days: DayOption[];
  subscription: SubscriptionSummary | null;
}

const STEPS = ['Serviço', 'Barbeiro', 'Data', 'Horário', 'Confirmar'];

export function BookingWizard({
  services,
  staff,
  staffServices,
  days,
  subscription,
}: BookingWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState(0);

  const [serviceId, setServiceId] = useState<string | null>(null);
  const [staffId, setStaffId] = useState<string | null>(null);
  const [dateStr, setDateStr] = useState<string | null>(null);
  const [slot, setSlot] = useState<SlotOption | null>(null);

  const [slots, setSlots] = useState<SlotOption[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsClosed, setSlotsClosed] = useState(false);
  const [booking, setBooking] = useState(false);
  const [slotsRefresh, setSlotsRefresh] = useState(0);

  const selectedService = services.find((s) => s.id === serviceId) ?? null;
  const selectedStaff = staff.find((s) => s.id === staffId) ?? null;
  const selectedDay = days.find((d) => d.dateStr === dateStr) ?? null;

  // Preco/duracao efetivos (override do barbeiro > base do servico)
  function effectiveFor(svcId: string, stfId: string) {
    const svc = services.find((s) => s.id === svcId);
    const ov = staffServices.find(
      (o) => o.service_id === svcId && o.staff_id === stfId
    );
    return {
      price:
        ov && ov.custom_price != null ? ov.custom_price : svc?.base_price ?? 0,
      duration:
        ov && ov.custom_duration_minutes != null
          ? ov.custom_duration_minutes
          : svc?.base_duration_minutes ?? 30,
    };
  }

  const effective =
    serviceId && staffId ? effectiveFor(serviceId, staffId) : null;

  // Cobertura pela assinatura (espelha a regra do servidor)
  const coverage = useMemo(() => {
    if (!subscription || !selectedDay || !serviceId) return null;
    const serviceCovered =
      subscription.coveredServiceIds.length === 0 ||
      subscription.coveredServiceIds.includes(serviceId);
    const dayAllowed =
      subscription.allowedDays.length === 0 ||
      subscription.allowedDays.includes(selectedDay.dow);
    const hasUses = subscription.usesLeft > 0 && !subscription.isExpired;

    if (dayAllowed && serviceCovered && hasUses) return 'covered' as const;
    if (!dayAllowed) return 'outside_days' as const;
    if (!serviceCovered) return 'service_not_included' as const;
    return 'no_uses' as const;
  }, [subscription, selectedDay, serviceId]);

  // Agrupar servicos por categoria
  const servicesByCategory = useMemo(() => {
    const map = new Map<string, ServiceOption[]>();
    for (const s of services) {
      const arr = map.get(s.category) ?? [];
      arr.push(s);
      map.set(s.category, arr);
    }
    return Array.from(map.entries());
  }, [services]);

  // Busca slots em tempo real (React 19 safe: closure cancelled)
  useEffect(() => {
    if (!staffId || !serviceId || !dateStr) return;
    let cancelled = false;

    setSlotsLoading(true);
    setSlots([]);
    setSlotsClosed(false);
    setSlot(null);

    getSlotsAction(staffId, serviceId, dateStr)
      .then((res) => {
        if (cancelled) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const r = res as any;
        setSlots((r.slots ?? []) as SlotOption[]);
        setSlotsClosed(Boolean(r.closed));
      })
      .catch(() => {
        if (!cancelled) setSlots([]);
      })
      .finally(() => {
        if (!cancelled) setSlotsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [staffId, serviceId, dateStr, slotsRefresh]);

  function goTo(newStep: number) {
    setStep(Math.max(0, Math.min(STEPS.length - 1, newStep)));
  }

  async function handleConfirm() {
    if (!serviceId || !staffId || !slot) return;
    setBooking(true);
    const result = await bookAppointment({
      service_id: serviceId,
      staff_id: staffId,
      startISO: slot.startISO,
    });
    setBooking(false);

    if (result.ok) {
      toast.success(
        result.covered
          ? 'Agendado! Esse atendimento será coberto pela sua assinatura.'
          : 'Agendamento confirmado!'
      );
      router.push('/cliente/agendamentos');
      router.refresh();
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((result as any).slotTaken) {
      toast.error(result.error ?? 'Horário indisponível');
      setSlot(null);
      goTo(3);
      setSlotsRefresh((n) => n + 1);
      return;
    }

    toast.error(result.error ?? 'Erro ao agendar');
  }

  return (
    <div className="space-y-5">
      {/* INDICADOR DE PASSOS */}
      <div className="flex items-center gap-1.5">
        {STEPS.map((label, i) => (
          <div key={label} className="flex-1">
            <div
              className={cn(
                'h-1 rounded-full transition-all',
                i <= step ? 'bg-gold' : 'bg-bg-elevated border border-border'
              )}
            />
            <p
              className={cn(
                'text-[9px] mt-1 text-center uppercase tracking-wider hidden sm:block',
                i === step ? 'text-gold font-semibold' : 'text-fg-dim'
              )}
            >
              {label}
            </p>
          </div>
        ))}
      </div>

      {/* BANNER ASSINANTE */}
      {subscription && step < 4 && (
        <div className="card p-3 flex items-center gap-2.5 border-gold/20">
          <Crown className="w-4 h-4 text-gold flex-shrink-0" />
          <p className="text-[11px] text-fg-muted leading-snug">
            <span className="text-gold font-semibold">
              {subscription.planName}
            </span>
            {subscription.isExpired ? (
              <> · ciclo vencido (renove na barbearia)</>
            ) : (
              <>
                {' '}
                · restam{' '}
                <span className="text-fg font-semibold">
                  {subscription.usesLeft} de {subscription.includedUses}
                </span>{' '}
                usos · dias com{' '}
                <Star className="w-2.5 h-2.5 inline text-gold fill-current -mt-0.5" />{' '}
                são cobertos
              </>
            )}
          </p>
        </div>
      )}

      {/* ===================== PASSO 1: SERVIÇO ===================== */}
      {step === 0 && (
        <div className="space-y-5 animate-fade-in">
          {servicesByCategory.map(([category, items]) => (
            <div key={category}>
              <p className="text-[10px] text-fg-dim uppercase tracking-[0.25em] mb-2">
                {category}
              </p>
              <div className="space-y-2">
                {items.map((svc) => {
                  const selected = serviceId === svc.id;
                  return (
                    <button
                      key={svc.id}
                      type="button"
                      onClick={() => {
                        setServiceId(svc.id);
                        goTo(1);
                      }}
                      className={cn(
                        'w-full text-left card p-4 flex items-center gap-3 transition-all',
                        selected
                          ? 'border-gold/50 bg-gold/5'
                          : 'hover:border-gold/30'
                      )}
                    >
                      <div className="w-10 h-10 rounded-md bg-gold/10 text-gold flex items-center justify-center flex-shrink-0">
                        <Scissors className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p
                          className="text-sm font-bold text-fg"
                          style={{ fontFamily: 'var(--font-playfair), serif' }}
                        >
                          {svc.name}
                        </p>
                        <p className="text-[10px] text-fg-subtle flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3" />
                          {svc.base_duration_minutes} min
                        </p>
                      </div>
                      <p className="text-base font-bold text-gold flex-shrink-0">
                        {formatCurrency(svc.base_price)}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ===================== PASSO 2: BARBEIRO ===================== */}
      {step === 1 && selectedService && (
        <div className="space-y-3 animate-fade-in">
          <p className="text-xs text-fg-muted">
            Quem vai cuidar do seu{' '}
            <span className="text-fg font-semibold">{selectedService.name}</span>?
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {staff.map((s) => {
              const eff = effectiveFor(selectedService.id, s.id);
              const selected = staffId === s.id;
              const initials = s.display_name
                .split(' ')
                .map((n) => n[0])
                .join('')
                .slice(0, 2)
                .toUpperCase();
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setStaffId(s.id);
                    goTo(2);
                  }}
                  className={cn(
                    'card p-4 flex items-center gap-3 text-left transition-all',
                    selected ? 'border-gold/50 bg-gold/5' : 'hover:border-gold/30'
                  )}
                >
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold text-bg flex-shrink-0"
                    style={{
                      background:
                        'linear-gradient(135deg, #D4A04F 0%, #F5C518 100%)',
                    }}
                  >
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-sm font-bold text-fg"
                      style={{ fontFamily: 'var(--font-playfair), serif' }}
                    >
                      {s.display_name}
                    </p>
                    <p className="text-[10px] text-fg-subtle mt-0.5">
                      {eff.duration} min · {formatCurrency(eff.price)}
                    </p>
                  </div>
                  <User className="w-4 h-4 text-gold flex-shrink-0" />
                </button>
              );
            })}
          </div>
          <BackButton onClick={() => goTo(0)} />
        </div>
      )}

      {/* ===================== PASSO 3: DATA ===================== */}
      {step === 2 && (
        <div className="space-y-3 animate-fade-in">
          <p className="text-xs text-fg-muted">Escolha o dia:</p>
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
            {days.map((d) => {
              const selected = dateStr === d.dateStr;
              const isPlanDay =
                subscription &&
                !subscription.isExpired &&
                (subscription.allowedDays.length === 0 ||
                  subscription.allowedDays.includes(d.dow));
              return (
                <button
                  key={d.dateStr}
                  type="button"
                  onClick={() => {
                    setDateStr(d.dateStr);
                    goTo(3);
                  }}
                  className={cn(
                    'flex-shrink-0 w-[68px] py-2.5 rounded-md border text-center transition-all relative',
                    selected
                      ? 'border-gold bg-gold/10'
                      : 'border-border bg-bg-elevated hover:border-gold/30'
                  )}
                >
                  {isPlanDay && (
                    <Star className="w-2.5 h-2.5 text-gold fill-current absolute top-1 right-1" />
                  )}
                  <p className="text-[9px] uppercase tracking-wider text-fg-subtle">
                    {d.isToday ? 'Hoje' : d.weekdayShort}
                  </p>
                  <p
                    className={cn(
                      'text-lg font-bold leading-tight',
                      selected ? 'text-gold' : 'text-fg'
                    )}
                    style={{ fontFamily: 'var(--font-playfair), serif' }}
                  >
                    {d.dayNum}
                  </p>
                  <p className="text-[9px] text-fg-dim">{d.monthShort}</p>
                </button>
              );
            })}
          </div>
          {subscription && !subscription.isExpired && (
            <p className="text-[10px] text-fg-subtle flex items-center gap-1">
              <Star className="w-2.5 h-2.5 text-gold fill-current" />
              Dias do seu plano ({subscription.planName})
            </p>
          )}
          <BackButton onClick={() => goTo(1)} />
        </div>
      )}

      {/* ===================== PASSO 4: HORÁRIO ===================== */}
      {step === 3 && selectedDay && (
        <div className="space-y-3 animate-fade-in">
          <p className="text-xs text-fg-muted">
            Horários livres de{' '}
            <span className="text-fg font-semibold">
              {selectedStaff?.display_name}
            </span>{' '}
            em{' '}
            <span className="text-fg font-semibold">
              {selectedDay.dayNum}/{selectedDay.monthShort}
            </span>
            :
          </p>

          {slotsLoading ? (
            <div className="card p-8 flex items-center justify-center gap-2 text-fg-muted text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Buscando horários...</span>
            </div>
          ) : slotsClosed ? (
            <div className="card p-6 text-center">
              <Calendar className="w-6 h-6 text-fg-subtle mx-auto mb-2" />
              <p className="text-xs text-fg-muted">
                A barbearia não atende neste dia. Escolha outra data.
              </p>
            </div>
          ) : slots.length === 0 ? (
            <div className="card p-6 text-center">
              <Clock className="w-6 h-6 text-fg-subtle mx-auto mb-2" />
              <p className="text-xs text-fg-muted">
                Sem horários livres neste dia. Tente outra data ou outro
                barbeiro.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
              {slots.map((s) => {
                const selected = slot?.startISO === s.startISO;
                return (
                  <button
                    key={s.startISO}
                    type="button"
                    onClick={() => {
                      setSlot(s);
                      goTo(4);
                    }}
                    className={cn(
                      'py-2.5 rounded-md border text-sm font-semibold transition-all',
                      selected
                        ? 'border-gold bg-gold/10 text-gold'
                        : 'border-border bg-bg-elevated text-fg hover:border-gold/40'
                    )}
                  >
                    {s.time}
                  </button>
                );
              })}
            </div>
          )}
          <BackButton onClick={() => goTo(2)} />
        </div>
      )}

      {/* ===================== PASSO 5: CONFIRMAR ===================== */}
      {step === 4 && selectedService && selectedStaff && selectedDay && slot && (
        <div className="space-y-4 animate-fade-in">
          <div className="card-premium p-5 space-y-3">
            <p className="text-[10px] text-gold tracking-[0.25em] uppercase font-semibold">
              Resumo do agendamento
            </p>

            <SummaryRow
              icon={Scissors}
              label="Serviço"
              value={selectedService.name}
            />
            <SummaryRow
              icon={User}
              label="Barbeiro"
              value={selectedStaff.display_name}
            />
            <SummaryRow
              icon={Calendar}
              label="Data"
              value={`${selectedDay.weekdayShort}, ${selectedDay.dayNum}/${selectedDay.monthShort}`}
            />
            <SummaryRow
              icon={Clock}
              label="Horário"
              value={`${slot.time} · ${effective?.duration ?? 0} min`}
            />

            <div className="h-px bg-border" />

            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-widest text-fg-dim">
                Valor
              </span>
              {coverage === 'covered' ? (
                <div className="text-right">
                  <p className="text-sm text-fg-subtle line-through">
                    {formatCurrency(effective?.price ?? 0)}
                  </p>
                  <p
                    className="text-xl font-bold text-gold"
                    style={{ fontFamily: 'var(--font-playfair), serif' }}
                  >
                    Coberto pela assinatura
                  </p>
                </div>
              ) : (
                <p
                  className="text-2xl font-bold text-gold"
                  style={{ fontFamily: 'var(--font-playfair), serif' }}
                >
                  {formatCurrency(effective?.price ?? 0)}
                </p>
              )}
            </div>
          </div>

          {coverage === 'covered' && (
            <div className="card p-3.5 border-gold/30 flex items-start gap-2.5">
              <Crown className="w-4 h-4 text-gold flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-fg-muted leading-relaxed">
                Esse atendimento será coberto pelo seu plano{' '}
                <span className="text-gold font-semibold">
                  {subscription?.planName}
                </span>{' '}
                e vai contar como 1 uso na hora do atendimento.
              </p>
            </div>
          )}

          {coverage === 'outside_days' && (
            <div className="card p-3.5 border-danger/30 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-danger flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-fg-muted leading-relaxed">
                Esse dia está fora dos dias do seu plano. Pode agendar normal,
                mas o atendimento{' '}
                <span className="text-fg font-semibold">
                  será cobrado à parte
                </span>{' '}
                e não conta como uso da assinatura.
              </p>
            </div>
          )}

          {coverage === 'no_uses' && (
            <div className="card p-3.5 border-danger/30 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-danger flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-fg-muted leading-relaxed">
                {subscription?.isExpired
                  ? 'Seu ciclo venceu. Renove na barbearia para voltar a usar a assinatura. Este atendimento será cobrado à parte.'
                  : 'Você já usou todos os atendimentos deste ciclo. Este será cobrado à parte.'}
              </p>
            </div>
          )}

          {coverage === 'service_not_included' && (
            <div className="card p-3.5 border-border flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-gold flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-fg-muted leading-relaxed">
                Este serviço não está incluso no seu plano e será cobrado à
                parte.
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={handleConfirm}
            disabled={booking}
            className="btn-gold-shimmer w-full flex items-center justify-center gap-2 py-3.5 text-base"
          >
            {booking ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Check className="w-5 h-5" />
            )}
            <span>Confirmar agendamento</span>
          </button>

          <BackButton onClick={() => goTo(3)} label="Trocar horário" />
        </div>
      )}
    </div>
  );
}

function BackButton({
  onClick,
  label = 'Voltar',
}: {
  onClick: () => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-xs text-fg-subtle hover:text-gold transition-colors flex items-center gap-1 py-1"
    >
      <ChevronLeft className="w-3.5 h-3.5" />
      <span>{label}</span>
    </button>
  );
}

function SummaryRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Scissors;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 rounded-md bg-gold/10 text-gold flex items-center justify-center flex-shrink-0">
        <Icon className="w-3.5 h-3.5" />
      </div>
      <div className="flex-1 flex items-center justify-between gap-2">
        <span className="text-[11px] text-fg-subtle uppercase tracking-wider">
          {label}
        </span>
        <span className="text-sm text-fg font-medium text-right">{value}</span>
      </div>
    </div>
  );
}
