'use server';

import { revalidatePath } from 'next/cache';
import { lojaAtual } from '@/lib/loja';
import { createManagerClient } from '@/lib/supabase/manager';

export interface StaffServiceData {
  staff_id: string;
  service_id: string;
  custom_price?: number | null;
  custom_duration_minutes?: number | null;
  custom_commission_percent?: number | null;
  active: boolean;
}

async function currentStoreHasStaffAndService(
  staffId: string,
  serviceId: string
) {
  const admin = await createManagerClient();
  const barbershopId = await lojaAtual();
  const [{ data: staff }, { data: service }] = await Promise.all([
    admin
      .from('staff')
      .select('id')
      .eq('id', staffId)
      .eq('barbershop_id', barbershopId)
      .maybeSingle(),
    admin
      .from('services')
      .select('id')
      .eq('id', serviceId)
      .eq('barbershop_id', barbershopId)
      .maybeSingle(),
  ]);

  if (!staff || !service) return null;
  return { admin, barbershopId };
}

/** Adiciona ou atualiza a associação, sempre dentro da unidade atual. */
export async function upsertStaffService(data: StaffServiceData) {
  const scope = await currentStoreHasStaffAndService(data.staff_id, data.service_id);
  if (!scope) return { ok: false, error: 'Profissional ou serviço não pertence a esta unidade.' };

  const { data: existing } = await scope.admin
    .from('staff_services')
    .select('id')
    .eq('barbershop_id', scope.barbershopId)
    .eq('staff_id', data.staff_id)
    .eq('service_id', data.service_id)
    .maybeSingle();

  const values = {
    custom_price: data.custom_price ?? null,
    custom_duration_minutes: data.custom_duration_minutes ?? null,
    custom_commission_percent: data.custom_commission_percent ?? null,
    active: data.active,
  };
  const { error } = existing
    ? await scope.admin
        .from('staff_services')
        .update(values)
        .eq('id', existing.id)
        .eq('barbershop_id', scope.barbershopId)
    : await scope.admin.from('staff_services').insert({
        ...values,
        barbershop_id: scope.barbershopId,
        staff_id: data.staff_id,
        service_id: data.service_id,
      });

  if (error) return { ok: false, error: error.message };
  revalidatePaths(data.service_id);
  return { ok: true };
}

/** Remove uma associação somente da unidade selecionada. */
export async function removeStaffService(staffId: string, serviceId: string) {
  const scope = await currentStoreHasStaffAndService(staffId, serviceId);
  if (!scope) return { ok: false, error: 'Profissional ou serviço não pertence a esta unidade.' };

  const { error } = await scope.admin
    .from('staff_services')
    .delete()
    .eq('barbershop_id', scope.barbershopId)
    .eq('staff_id', staffId)
    .eq('service_id', serviceId);

  if (error) return { ok: false, error: error.message };
  revalidatePaths(serviceId);
  return { ok: true };
}

/** Ativa ou desativa uma associação somente da unidade selecionada. */
export async function toggleStaffService(staffId: string, serviceId: string, active: boolean) {
  const scope = await currentStoreHasStaffAndService(staffId, serviceId);
  if (!scope) return { ok: false, error: 'Profissional ou serviço não pertence a esta unidade.' };

  const { error } = await scope.admin
    .from('staff_services')
    .update({ active })
    .eq('barbershop_id', scope.barbershopId)
    .eq('staff_id', staffId)
    .eq('service_id', serviceId);

  if (error) return { ok: false, error: error.message };
  revalidatePaths(serviceId);
  return { ok: true };
}

function revalidatePaths(serviceId: string) {
  revalidatePath('/admin/servicos');
  revalidatePath(`/admin/servicos/${serviceId}`);
  revalidatePath('/admin/profissionais');
}
