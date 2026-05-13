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
 * - appointments NÃO tem service_id direto (foi movido para appointment_services)
 * - status default é 'scheduled' (enum appointment_status)
 * - Se service_id for fornecido, cria também a entrada em appointment_services
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

  if (data.notes) payload.notes = data.notes;

  const { data: created, error } = await admin
    .from('appointments')
    .insert(payload)
    .select()
    .single();

  if (error) return { ok: false, error: error.message };

  // Se um serviço foi escolhido, criar entrada em appointment_services
  if (data.service_id) {
    // Buscar preço, duração e commission_percent do staff
    const [{ data: service }, { data: staff }] = await Promise.all([
      admin
        .from('services')
        .select('base_price, base_duration_minutes')
        .eq('id', data.service_id)
        .maybeSingle(),
      admin
        .from('staff')
        .select('default_commission_percent')
        .eq('id', data.staff_id)
        .maybeSingle(),
    ]);

    if (service) {
      const start = new Date(data.start_at).getTime();
      const end = new Date(data.end_at).getTime();
      const durationMinutes =
        Math.round((end - start) / 60000) ||
        Number(service.base_duration_minutes ?? 30);

      await admin.from('appointment_services').insert({
        barbershop_id: BARBERSHOP_ID,
        appointment_id: created.id,
        service_id: data.service_id,
        price: Number(service.base_price ?? 0),
        duration_minutes: durationMinutes,
        commission_percent: Number(staff?.default_commission_percent ?? 0),
      });
    }
  }

  revalidatePath('/admin/agenda');
  revalidatePath('/admin');
  return { ok: true, appointment: created };
}

/**
 * Atualiza status do agendamento (confirmar, cancelar, completar, etc.).
 * Enum appointment_status: scheduled | in_progress | completed | cancelled | no_show
 */
export async function updateAppointmentStatus(
  id: string,
  status:
    | 'scheduled'
    | 'in_progress'
    | 'completed'
    | 'cancelled'
    | 'no_show'
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

  // Remove service_id do payload se vier (deve ser tratado via appointment_services)
  const { service_id: _ignoredServiceId, ...rest } = data;

  const { error } = await admin
    .from('appointments')
    .update(rest)
    .eq('id', id);

  if (error) return { ok: false, error: error.message };

  revalidatePath('/admin/agenda');
  return { ok: true };
}

/**
 * Deleta agendamento (e seus appointment_services via cascade do FK).
 */
export async function deleteAppointment(id: string) {
  const admin = createAdminClient();

  // Tenta deletar appointment_services manualmente caso não tenha cascade
  await admin.from('appointment_services').delete().eq('appointment_id', id);

  const { error } = await admin.from('appointments').delete().eq('id', id);

  if (error) return { ok: false, error: error.message };

  revalidatePath('/admin/agenda');
  return { ok: true };
}
