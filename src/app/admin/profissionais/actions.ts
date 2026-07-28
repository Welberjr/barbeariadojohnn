'use server';

import { createManagerClient } from '@/lib/supabase/manager';
import { revalidatePath } from 'next/cache';
import { getSessionStaff } from '@/lib/staff-auth';
import { buildStaffPermissions, PRESETS_POR_PAPEL } from '@/lib/staff-permissions';

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
  const supabase = await createManagerClient();
  const admin = await createManagerClient();

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

  // 4. Cria staff vinculado, já com o acesso sugerido para o papel.
  // É sugestão: o gestor ajusta no bloco de acesso logo depois.
  const preset = PRESETS_POR_PAPEL[data.role] ?? { canManage: false, modulos: [] };

  const { error: staffError } = await admin.from('staff').insert({
    barbershop_id: BARBERSHOP_ID,
    profile_id: profileId,
    display_name: data.display_name,
    role: data.role,
    bio: data.bio ?? null,
    specialties: data.specialties && data.specialties.length > 0 ? data.specialties : null,
    default_commission_percent: data.default_commission_percent,
    active: data.active,
    can_manage: preset.canManage,
    permissions: buildStaffPermissions(preset.modulos),
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
  const admin = await createManagerClient();

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
  const admin = await createManagerClient();

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

// ============================================================
// ACESSO AO SISTEMA
// ============================================================

/**
 * Salva o acesso de um profissional: gestao e modulos do painel.
 *
 * A gravacao passa pela funcao set_staff_access, que faz tudo dentro de uma
 * transacao com trava. Isso impede que dois gestores, removendo acesso ao
 * mesmo tempo, deixem a barbearia sem ninguem com gestao.
 */
export async function salvarAcessoStaff(
  staffId: string,
  canManage: boolean,
  modulos: string[]
) {
  const admin = await createManagerClient();
  const ator = await getSessionStaff();

  const permissions = buildStaffPermissions(modulos);

  const { error } = await admin.rpc('set_staff_access', {
    p_staff_id: staffId,
    p_can_manage: canManage,
    p_permissions: permissions,
    p_actor_staff_id: ator?.staffId ?? null,
  });

  if (error) {
    // A funcao devolve mensagem pronta para o gestor ler
    return { ok: false, error: error.message };
  }

  revalidatePath('/admin/profissionais');
  revalidatePath(`/admin/profissionais/${staffId}`);
  return { ok: true };
}

const PALAVRAS_SENHA = ['navalha', 'tesoura', 'pente', 'barba', 'corte', 'maquina'];

/**
 * Define uma senha de acesso para o profissional e obriga a troca no primeiro
 * uso. A senha volta uma unica vez, para o gestor copiar e entregar.
 */
export async function definirSenhaAcesso(staffId: string) {
  const admin = await createManagerClient();
  const ator = await getSessionStaff();

  const { data: staff } = await admin
    .from('staff')
    .select('profile_id, display_name, active, fired_at')
    .eq('id', staffId)
    .maybeSingle();

  if (!staff?.profile_id) {
    return { ok: false, error: 'Profissional sem usuário vinculado.' };
  }
  if (staff.active === false || staff.fired_at) {
    return { ok: false, error: 'Profissional inativo não recebe senha de acesso.' };
  }

  const palavra = PALAVRAS_SENHA[Math.floor(Math.random() * PALAVRAS_SENHA.length)];
  const numero = String(Math.floor(1000 + Math.random() * 9000));
  const senha = `${palavra}${numero}`;

  const { error: authError } = await admin.auth.admin.updateUserById(
    staff.profile_id as string,
    { password: senha }
  );

  if (authError) {
    return { ok: false, error: authError.message };
  }

  const { error: flagError } = await admin
    .from('staff')
    .update({ must_change_password: true })
    .eq('id', staffId);

  if (flagError) {
    return { ok: false, error: flagError.message };
  }

  await admin.from('staff_access_log').insert({
    staff_id: staffId,
    actor_staff_id: ator?.staffId ?? null,
    action: 'set_password',
    after_value: { must_change_password: true },
  });

  revalidatePath(`/admin/profissionais/${staffId}`);
  return { ok: true, senha };
}

/**
 * Reativa um profissional.
 */
export async function reactivateStaff(staffId: string) {
  const admin = await createManagerClient();

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
