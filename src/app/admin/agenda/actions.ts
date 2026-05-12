'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';

const BARBERSHOP_ID = '11111111-1111-1111-1111-111111111111';

export interface AppointmentData {
  customer_id: string;
  staff_id: string;
  start_at: string; // ISO timestamp
  end_at: string; // ISO timestamp
  service_id?: string | null;
  notes?: string | null;
  status?: string;
  source?: string;
}

/**
 * Cria um agendamento.
 */
export async function createAppointment(data: AppointmentData) {
  const admin = createAdminClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payload: any = {
    barbershop_id: BARBERSHOP_ID,
    customer_id: data.customer_id,
    staff_id: data.staff_id,
    start_at: data.start_at,
    end_at: data.end_at,
    status: data.status ?? 'scheduled',
    source: data.source ?? 'manual',
  };

  if (data.service_id) payload.service_id = data.service_id;
  if (data.notes) payload.notes = data.notes;

  const { data: created, error } = await admin
    .from('appointments')
    .insert(payload)
    .select()
    .single();

  if (error) return { ok: false, error: error.message };

  revalidatePath('/admin/agenda');
  revalidatePath('/admin');
  return { ok: true, appointment: created };
}

/**
 * Atualiza status do agendamento (confirmar, cancelar, completar, etc.).
 */
export async function updateAppointmentStatus(
  id: string,
  status: 'scheduled' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show'
) {
  const admin = createAdminClient();

  const { error } = await admin
    .from('appointments')
    .update({ status })
    .eq('id', id);

  if (error) return { ok: false, error: error.message };

  revalidatePath('/admin/agenda');
  revalidatePath('/admin');
  return { ok: true };
}

/**
 * Atualiza dados do agendamento.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function updateAppointment(id: string, data: any) {
  const admin = createAdminClient();

  const { error } = await admin.from('appointments').update(data).eq('id', id);

  if (error) return { ok: false, error: error.message };

  revalidatePath('/admin/agenda');
  return { ok: true };
}

/**
 * Deleta agendamento.
 */
export async function deleteAppointment(id: string) {
  const admin = createAdminClient();

  const { error } = await admin.from('appointments').delete().eq('id', id);

  if (error) return { ok: false, error: error.message };

  revalidatePath('/admin/agenda');
  return { ok: true };
}
