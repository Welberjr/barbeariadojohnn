'use server';

import { createManagerClient } from '@/lib/supabase/manager';
import { revalidatePath } from 'next/cache';
import {
  validarJornada,
  paraHorarioSemanal,
  type JornadaSimples,
} from '@/lib/jornada';

const BARBERSHOP_ID = '11111111-1111-1111-1111-111111111111';

// =============================================================
// BUSINESS HOURS — horário de funcionamento da barbearia
// =============================================================

export interface DayHours {
  open: string;   // "09:00"
  close: string;  // "20:00"
  closed: boolean;
}

export interface BusinessHours {
  monday: DayHours;
  tuesday: DayHours;
  wednesday: DayHours;
  thursday: DayHours;
  friday: DayHours;
  saturday: DayHours;
  sunday: DayHours;
}

export async function updateBusinessHours(hours: BusinessHours) {
  const admin = await createManagerClient();

  const { error } = await admin
    .from('barbershops')
    .update({ business_hours: hours })
    .eq('id', BARBERSHOP_ID);

  if (error) return { ok: false, error: error.message };

  revalidatePath('/admin/disponibilidade');
  revalidatePath('/admin/configuracoes');
  return { ok: true };
}

// =============================================================
// DAYS OFF — folgas e bloqueios
// =============================================================

export interface DayOffData {
  staff_id?: string | null; // null = barbearia toda
  start_date: string; // ISO date "YYYY-MM-DD"
  end_date?: string | null; // null = só o dia inicial
  reason?: string | null;
  type?: string; // 'day_off' | 'vacation' | 'holiday' | etc.
}

export async function createDayOff(data: DayOffData) {
  const admin = await createManagerClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payload: any = {
    barbershop_id: BARBERSHOP_ID,
    start_date: data.start_date,
    end_date: data.end_date ?? data.start_date,
    type: data.type ?? 'day_off',
  };

  if (data.staff_id) payload.staff_id = data.staff_id;
  if (data.reason) payload.reason = data.reason;

  const { error } = await admin.from('days_off').insert(payload);

  if (error) return { ok: false, error: error.message };

  revalidatePath('/admin/disponibilidade');
  revalidatePath('/admin/agenda');
  return { ok: true };
}

export async function deleteDayOff(id: string) {
  const admin = await createManagerClient();

  const { error } = await admin.from('days_off').delete().eq('id', id);

  if (error) return { ok: false, error: error.message };

  revalidatePath('/admin/disponibilidade');
  revalidatePath('/admin/agenda');
  return { ok: true };
}

// =============================================================
// JORNADA DO PROFISSIONAL — horario proprio e almoco
// =============================================================

/**
 * Grava a jornada de um profissional.
 *
 * Quem segue a barbearia nao guarda horario proprio: o campo fica nulo, e no dia
 * em que a loja mudar o expediente ele muda junto, sem ninguem lembrar de
 * atualizar sete cadastros na mao.
 */
export async function salvarJornada(dados: {
  staffId: string;
  segueALoja: boolean;
  jornada: JornadaSimples;
}) {
  const admin = await createManagerClient();

  if (!dados.segueALoja) {
    const problema = validarJornada(dados.jornada);
    if (problema) return { ok: false, error: problema };
  }

  const temAlmoco = !!dados.jornada.almocoInicio && !!dados.jornada.almocoFim;

  const { error } = await admin
    .from('staff')
    .update({
      use_barbershop_hours: dados.segueALoja,
      custom_hours: dados.segueALoja ? null : paraHorarioSemanal(dados.jornada),
      // O almoco vale mesmo para quem segue o horario da loja: a barbearia
      // fica aberta, mas aquela pessoa nao esta na cadeira.
      lunch_start: temAlmoco ? dados.jornada.almocoInicio : null,
      lunch_end: temAlmoco ? dados.jornada.almocoFim : null,
    })
    .eq('id', dados.staffId);

  if (error) return { ok: false, error: error.message };

  revalidatePath('/admin/disponibilidade');
  revalidatePath('/admin/agenda');
  revalidatePath('/cliente/agendar');
  return { ok: true };
}
