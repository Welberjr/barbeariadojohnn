'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';

const BARBERSHOP_ID = '11111111-1111-1111-1111-111111111111';

export interface StaffFormData {
  full_name: string;
  email: string;
  phone?: string;
  display_name: string;
  role: 'owner' | 'manager' | 'barber' | 'receptionist' | 'assistant';
  bio?: string;
  specialties?: string[];
  default_commission_percent: number;
  active: boolean;
}

/**
 * Cria um novo profissional.
 *
 * Fluxo:
 * 1. Verifica se já existe profile com esse email
 * 2. Se não existe: cria auth user (admin API) + profile
 * 3. Cria staff vinculado ao profile
 */
export async function createStaff(data: StaffFormData) {
  const supabase = await createClient();
  const admin = createAdminClient();

  let profileId: string;

  // 1. Verifica se já existe profile com esse email
  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', data.email)
    .maybeSingle();

  if (existingProfile) {
    profileId = existingProfile.id;
  } else {
    // 2. Cria auth user (usuário pode resetar senha depois)
    const tempPassword =
      Math.random().toString(36).slice(2, 12) +
      Math.random().toString(36).slice(2, 12).toUpperCase() +
      '@1';

    const { data: authUser, error: authError } = await admin.auth.admin.createUser({
      email: data.email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name: data.full_name },
    });

    if (authError || !authUser?.user) {
      return {
        ok: false,
        error: authError?.message ?? 'Falha ao criar usuário.',
      };
    }

    profileId = authUser.user.id;

    // 3. Cria profile (usando admin pra bypass RLS)
    const { error: profileError } = await admin.from('profiles').insert({
      id: profileId,
      full_name: data.full_name,
      email: data.email,
      phone: data.phone ?? null,
    });

    if (profileError) {
      return { ok: false, error: profileError.message };
    }
  }

  // 4. Cria staff vinculado
  const { error: staffError } = await admin.from('staff').insert({
    barbershop_id: BARBERSHOP_ID,
    profile_id: profileId,
    display_name: data.display_name,
    role: data.role,
    bio: data.bio ?? null,
    specialties: data.specialties && data.specialties.length > 0 ? data.specialties : null,
    default_commission_percent: data.default_commission_percent,
    active: data.active,
  });

  if (staffError) {
    return { ok: false, error: staffError.message };
  }

  revalidatePath('/admin/profissionais');
  return { ok: true };
}

/**
 * Atualiza um profissional existente.
 */
export async function updateStaff(staffId: string, data: StaffFormData) {
  const admin = createAdminClient();

  const { data: staff, error: staffFetchError } = await admin
    .from('staff')
    .select('profile_id')
    .eq('id', staffId)
    .single();

  if (staffFetchError || !staff) {
    return { ok: false, error: 'Profissional não encontrado.' };
  }

  // Atualiza profile
  const { error: profileError } = await admin
    .from('profiles')
    .update({
      full_name: data.full_name,
      email: data.email,
      phone: data.phone ?? null,
    })
    .eq('id', staff.profile_id);

  if (profileError) {
    return { ok: false, error: profileError.message };
  }

  // Atualiza staff
  const { error: staffError } = await admin
    .from('staff')
    .update({
      display_name: data.display_name,
      role: data.role,
      bio: data.bio ?? null,
      specialties: data.specialties && data.specialties.length > 0 ? data.specialties : null,
      default_commission_percent: data.default_commission_percent,
      active: data.active,
    })
    .eq('id', staffId);

  if (staffError) {
    return { ok: false, error: staffError.message };
  }

  revalidatePath('/admin/profissionais');
  revalidatePath(`/admin/profissionais/${staffId}`);
  return { ok: true };
}

/**
 * Desativa um profissional (soft delete).
 */
export async function deactivateStaff(staffId: string) {
  const admin = createAdminClient();

  const { error } = await admin
    .from('staff')
    .update({ active: false, fired_at: new Date().toISOString() })
    .eq('id', staffId);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath('/admin/profissionais');
  return { ok: true };
}

/**
 * Reativa um profissional.
 */
export async function reactivateStaff(staffId: string) {
  const admin = createAdminClient();

  const { error } = await admin
    .from('staff')
    .update({ active: true, fired_at: null })
    .eq('id', staffId);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath('/admin/profissionais');
  return { ok: true };
}
