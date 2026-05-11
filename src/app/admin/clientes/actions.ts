'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';

const BARBERSHOP_ID = '11111111-1111-1111-1111-111111111111';

export interface CustomerFormData {
  full_name: string;
  phone: string;
  email?: string;
  cpf?: string;
  birth_date?: string;
  notes?: string;
  allergies?: string;
  preferred_barber_id?: string;
  accepts_marketing: boolean;
  active: boolean;
}

export async function createCustomer(data: CustomerFormData) {
  const admin = createAdminClient();

  const { error } = await admin.from('customers').insert({
    barbershop_id: BARBERSHOP_ID,
    full_name: data.full_name,
    phone: data.phone,
    email: data.email || null,
    cpf: data.cpf || null,
    birth_date: data.birth_date || null,
    notes: data.notes || null,
    allergies: data.allergies || null,
    preferred_barber_id: data.preferred_barber_id || null,
    accepts_marketing: data.accepts_marketing,
    active: data.active,
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath('/admin/clientes');
  return { ok: true };
}

export async function updateCustomer(id: string, data: CustomerFormData) {
  const admin = createAdminClient();

  const { error } = await admin
    .from('customers')
    .update({
      full_name: data.full_name,
      phone: data.phone,
      email: data.email || null,
      cpf: data.cpf || null,
      birth_date: data.birth_date || null,
      notes: data.notes || null,
      allergies: data.allergies || null,
      preferred_barber_id: data.preferred_barber_id || null,
      accepts_marketing: data.accepts_marketing,
      active: data.active,
    })
    .eq('id', id);

  if (error) return { ok: false, error: error.message };

  revalidatePath('/admin/clientes');
  revalidatePath(`/admin/clientes/${id}`);
  return { ok: true };
}

export async function deactivateCustomer(id: string) {
  const admin = createAdminClient();
  const { error } = await admin
    .from('customers')
    .update({ active: false })
    .eq('id', id);

  if (error) return { ok: false, error: error.message };

  revalidatePath('/admin/clientes');
  return { ok: true };
}
