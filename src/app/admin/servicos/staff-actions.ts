'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';

const BARBERSHOP_ID = '11111111-1111-1111-1111-111111111111';

export interface StaffServiceData {
  staff_id: string;
  service_id: string;
  custom_price?: number | null;
  custom_duration_minutes?: number | null;
  custom_commission_percent?: number | null;
  active: boolean;
}

/**
 * Adiciona um profissional a um serviço (com preço/duração customizados opcionais).
 * Se já existe, atualiza.
 */
export async function upsertStaffService(data: StaffServiceData) {
  const admin = createAdminClient();

  // Verifica se já existe
  const { data: existing } = await admin
    .from('staff_services')
    .select('id')
    .eq('staff_id', data.staff_id)
    .eq('service_id', data.service_id)
    .maybeSingle();

  if (existing) {
    const { error } = await admin
      .from('staff_services')
      .update({
        custom_price: data.custom_price ?? null,
        custom_duration_minutes: data.custom_duration_minutes ?? null,
        custom_commission_percent: data.custom_commission_percent ?? null,
        active: data.active,
      })
      .eq('id', existing.id);

    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await admin.from('staff_services').insert({
      barbershop_id: BARBERSHOP_ID,
      staff_id: data.staff_id,
      service_id: data.service_id,
      custom_price: data.custom_price ?? null,
      custom_duration_minutes: data.custom_duration_minutes ?? null,
      custom_commission_percent: data.custom_commission_percent ?? null,
      active: data.active,
    });

    if (error) return { ok: false, error: error.message };
  }

  revalidatePath('/admin/servicos');
  revalidatePath(`/admin/servicos/${data.service_id}`);
  revalidatePath('/admin/profissionais');
  return { ok: true };
}

/**
 * Remove a associação entre profissional e serviço.
 */
export async function removeStaffService(staffId: string, serviceId: string) {
  const admin = createAdminClient();

  const { error } = await admin
    .from('staff_services')
    .delete()
    .eq('staff_id', staffId)
    .eq('service_id', serviceId);

  if (error) return { ok: false, error: error.message };

  revalidatePath('/admin/servicos');
  revalidatePath(`/admin/servicos/${serviceId}`);
  return { ok: true };
}

/**
 * Toggle active/inactive na associação.
 */
export async function toggleStaffService(
  staffId: string,
  serviceId: string,
  active: boolean
) {
  const admin = createAdminClient();

  const { error } = await admin
    .from('staff_services')
    .update({ active })
    .eq('staff_id', staffId)
    .eq('service_id', serviceId);

  if (error) return { ok: false, error: error.message };

  revalidatePath('/admin/servicos');
  revalidatePath(`/admin/servicos/${serviceId}`);
  return { ok: true };
}
