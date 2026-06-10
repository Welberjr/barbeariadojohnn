/**
 * Motor de horarios (slots) para agendamento.
 *
 * Calcula horarios livres em tempo real a partir de:
 *  - business_hours da barbearia (jsonb com chaves monday..sunday)
 *  - custom_hours do profissional (mesmo formato) quando use_barbershop_hours=false
 *  - days_off (folgas da loja e do profissional, dia inteiro ou faixa)
 *  - appointments existentes (scheduled / in_progress) com sobreposicao
 *
 * Slots em passos de 30 min; um slot e valido se o servico inteiro couber
 * dentro do expediente sem conflitar com nada.
 */
import { createAdminClient } from '@/lib/supabase/admin';
import { shopDayOfWeek } from '@/lib/subscriptions';

const BARBERSHOP_ID = '11111111-1111-1111-1111-111111111111';
const SLOT_STEP_MINUTES = 30;
const SHOP_UTC_OFFSET = '-03:00'; // Brasília (sem horario de verao)

const DAY_KEYS = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const;

interface DayHours {
  open?: string;
  close?: string;
  closed?: boolean;
}

function parseHM(hm: string): number {
  const [h, m] = hm.split(':').map((n) => parseInt(n, 10));
  return h * 60 + (m || 0);
}

function minutesToHM(min: number): string {
  const h = Math.floor(min / 60)
    .toString()
    .padStart(2, '0');
  const m = (min % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

/** Constroi um Date absoluto a partir de data local da loja + hora. */
export function shopDateTime(dateStr: string, hm: string): Date {
  return new Date(`${dateStr}T${hm}:00${SHOP_UTC_OFFSET}`);
}

export interface SlotResult {
  time: string; // "HH:MM"
  startISO: string;
}

export interface SlotsResponse {
  ok: boolean;
  closed?: boolean;
  reason?: string;
  slots: SlotResult[];
  durationMinutes: number;
}

/**
 * Slots livres de um profissional, numa data, para um servico.
 * dateStr: 'yyyy-mm-dd' (data local da barbearia).
 */
export async function getAvailableSlots(opts: {
  staffId: string;
  serviceId: string;
  dateStr: string;
}): Promise<SlotsResponse> {
  const admin = createAdminClient();
  const { staffId, serviceId, dateStr } = opts;

  // 1. Duracao do servico (custom do staff > base)
  const [{ data: service }, { data: staffService }, { data: staff }, { data: shop }] =
    await Promise.all([
      admin
        .from('services')
        .select('base_duration_minutes, active')
        .eq('id', serviceId)
        .maybeSingle(),
      admin
        .from('staff_services')
        .select('custom_duration_minutes, active')
        .eq('staff_id', staffId)
        .eq('service_id', serviceId)
        .maybeSingle(),
      admin
        .from('staff')
        .select('use_barbershop_hours, custom_hours, active')
        .eq('id', staffId)
        .maybeSingle(),
      admin
        .from('barbershops')
        .select('business_hours')
        .eq('id', BARBERSHOP_ID)
        .maybeSingle(),
    ]);

  if (!service || service.active === false) {
    return { ok: false, reason: 'Serviço indisponível', slots: [], durationMinutes: 0 };
  }
  if (!staff || staff.active === false) {
    return { ok: false, reason: 'Profissional indisponível', slots: [], durationMinutes: 0 };
  }

  const durationMinutes =
    Number(staffService?.custom_duration_minutes) ||
    Number(service.base_duration_minutes) ||
    30;

  // 2. Expediente do dia
  const noonRef = shopDateTime(dateStr, '12:00');
  const dow = shopDayOfWeek(noonRef);
  const dayKey = DAY_KEYS[dow];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hoursSource: Record<string, DayHours> =
    staff.use_barbershop_hours === false && staff.custom_hours
      ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (staff.custom_hours as any)
      : // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ((shop?.business_hours ?? {}) as any);

  const dayHours = hoursSource?.[dayKey];
  if (!dayHours || dayHours.closed || !dayHours.open || !dayHours.close) {
    return { ok: true, closed: true, slots: [], durationMinutes };
  }

  const openMin = parseHM(dayHours.open);
  const closeMin = parseHM(dayHours.close);
  if (closeMin <= openMin) {
    return { ok: true, closed: true, slots: [], durationMinutes };
  }

  // 3. Folgas (loja inteira: staff_id null; ou do profissional)
  const { data: daysOff } = await admin
    .from('days_off')
    .select('staff_id, start_date, end_date, full_day, start_time, end_time')
    .eq('barbershop_id', BARBERSHOP_ID)
    .lte('start_date', dateStr)
    .gte('end_date', dateStr);

  const blockedRanges: Array<{ start: number; end: number }> = [];
  for (const off of daysOff ?? []) {
    if (off.staff_id && off.staff_id !== staffId) continue;
    if (off.full_day !== false) {
      return { ok: true, closed: true, reason: 'Folga', slots: [], durationMinutes };
    }
    if (off.start_time && off.end_time) {
      blockedRanges.push({
        start: parseHM(String(off.start_time).slice(0, 5)),
        end: parseHM(String(off.end_time).slice(0, 5)),
      });
    }
  }

  // 4. Agendamentos existentes do profissional no dia
  const dayStart = shopDateTime(dateStr, '00:00').toISOString();
  const dayEnd = shopDateTime(dateStr, '23:59').toISOString();
  const { data: appts } = await admin
    .from('appointments')
    .select('start_at, end_at, status')
    .eq('barbershop_id', BARBERSHOP_ID)
    .eq('staff_id', staffId)
    .in('status', ['scheduled', 'in_progress'])
    .gte('start_at', dayStart)
    .lte('start_at', dayEnd);

  const busy: Array<{ start: number; end: number }> = (appts ?? []).map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (a: any) => {
      const s = new Date(a.start_at);
      const e = new Date(a.end_at);
      const base = shopDateTime(dateStr, '00:00').getTime();
      return {
        start: Math.round((s.getTime() - base) / 60000),
        end: Math.round((e.getTime() - base) / 60000),
      };
    }
  );
  busy.push(...blockedRanges);

  // 5. Gera slots
  const now = new Date();
  const isToday =
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now) === dateStr;

  const slots: SlotResult[] = [];
  for (let t = openMin; t + durationMinutes <= closeMin; t += SLOT_STEP_MINUTES) {
    const slotStart = t;
    const slotEnd = t + durationMinutes;

    const conflict = busy.some((b) => slotStart < b.end && slotEnd > b.start);
    if (conflict) continue;

    const startDate = shopDateTime(dateStr, minutesToHM(slotStart));
    if (isToday && startDate.getTime() <= now.getTime() + 15 * 60000) continue; // 15 min de antecedencia

    slots.push({ time: minutesToHM(slotStart), startISO: startDate.toISOString() });
  }

  return { ok: true, slots, durationMinutes };
}

/**
 * Verifica se um horario especifico continua livre (revalidacao no booking,
 * evita corrida entre dois clientes escolhendo o mesmo slot).
 */
export async function isSlotStillFree(opts: {
  staffId: string;
  startISO: string;
  endISO: string;
}): Promise<boolean> {
  const admin = createAdminClient();
  const { data: conflicts } = await admin
    .from('appointments')
    .select('id')
    .eq('barbershop_id', BARBERSHOP_ID)
    .eq('staff_id', opts.staffId)
    .in('status', ['scheduled', 'in_progress'])
    .lt('start_at', opts.endISO)
    .gt('end_at', opts.startISO)
    .limit(1);

  return (conflicts ?? []).length === 0;
}
