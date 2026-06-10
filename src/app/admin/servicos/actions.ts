'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';

const BARBERSHOP_ID = '11111111-1111-1111-1111-111111111111';

export interface ServiceFormData {
  name: string;
  description?: string;
  category?: string;
  base_price: number;
  base_duration_minutes: number;
  base_commission_percent: number;
  show_on_public_menu: boolean;
  display_order: number;
  active: boolean;
}

export async function createService(data: ServiceFormData) {
  const admin = createAdminClient();

  const { error } = await admin.from('services').insert({
    barbershop_id: BARBERSHOP_ID,
    name: data.name,
    description: data.description ?? null,
    category: data.category ?? null,
    base_price: data.base_price,
    base_duration_minutes: data.base_duration_minutes,
    base_commission_percent: data.base_commission_percent,
    show_on_public_menu: data.show_on_public_menu,
    display_order: data.display_order,
    active: data.active,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath('/admin/servicos');
  return { ok: true };
}

export async function updateService(serviceId: string, data: ServiceFormData) {
  const admin = createAdminClient();

  const { error } = await admin
    .from('services')
    .update({
      name: data.name,
      description: data.description ?? null,
      category: data.category ?? null,
      base_price: data.base_price,
      base_duration_minutes: data.base_duration_minutes,
      base_commission_percent: data.base_commission_percent,
      show_on_public_menu: data.show_on_public_menu,
      display_order: data.display_order,
      active: data.active,
    })
    .eq('id', serviceId);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath('/admin/servicos');
  revalidatePath(`/admin/servicos/${serviceId}`);
  return { ok: true };
}

export async function deleteService(serviceId: string) {
  const admin = createAdminClient();

  // Soft delete: apenas desativa
  const { error } = await admin
    .from('services')
    .update({ active: false })
    .eq('id', serviceId);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath('/admin/servicos');
  return { ok: true };
}
