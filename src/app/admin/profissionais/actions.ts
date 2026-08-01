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
 * O que fica pendurado se a pessoa sair hoje.
 *
 * Desligar alguem no meio do expediente tem consequencia: cliente marcado com
 * ele fica sem barbeiro, comanda aberta trava o caixa, e comissao que ele ja
 * ganhou continua sendo dele. A gestao precisa ver isso antes de decidir, e nao
 * descobrir na segunda-feira quando o cliente aparecer.
 */
export async function pendenciasDoProfissional(staffId: string) {
  const admin = await createManagerClient();
  const agora = new Date().toISOString();

  const [
    { count: agendamentos },
    { count: comandasAbertas },
    { count: valesPendentes },
    { count: atendimentos },
    { data: itens },
  ] = await Promise.all([
    admin
      .from('appointments')
      .select('id', { count: 'exact', head: true })
      .eq('staff_id', staffId)
      .in('status', ['scheduled', 'confirmed', 'in_progress'])
      .gte('start_at', agora),
    admin
      .from('comandas')
      .select('id', { count: 'exact', head: true })
      .eq('staff_id', staffId)
      .eq('status', 'open'),
    admin
      .from('allowances')
      .select('id', { count: 'exact', head: true })
      .eq('staff_id', staffId)
      .eq('status', 'pending'),
    admin
      .from('comandas')
      .select('id', { count: 'exact', head: true })
      .eq('staff_id', staffId)
      .eq('status', 'closed'),
    admin
      .from('comanda_items')
      .select('commission_value')
      .eq('staff_id', staffId)
      .limit(3000),
  ]);

  const comissaoGerada = (itens ?? []).reduce(
    (soma, i) => soma + Number(i.commission_value ?? 0),
    0
  );

  return {
    ok: true as const,
    agendamentosFuturos: agendamentos ?? 0,
    comandasAbertas: comandasAbertas ?? 0,
    valesPendentes: valesPendentes ?? 0,
    atendimentosFeitos: atendimentos ?? 0,
    comissaoGerada,
    /** Sem nenhum movimento, a ficha pode sumir de vez sem estragar nada */
    podeApagarDeVez: (atendimentos ?? 0) === 0 && (comandasAbertas ?? 0) === 0,
  };
}

/**
 * Desliga um profissional.
 *
 * Ele sai da agenda, some das listas e perde o acesso ao painel na mesma hora:
 * a portaria confere no banco a cada tela, entao nem sessao ja aberta continua
 * valendo. O que ele fez continua no lugar, porque comanda fechada e dinheiro
 * que ja passou pelo caixa, e apagar isso faria o faturamento do mes mudar
 * sozinho depois de fechado.
 *
 * Os atendimentos futuros dele sao cancelados junto, senao ficam clientes
 * marcados com alguem que nao trabalha mais na casa.
 */
export async function deactivateStaff(staffId: string, motivo?: string) {
  const admin = await createManagerClient();

  const { data: staff } = await admin
    .from('staff')
    .select('id, display_name, can_manage')
    .eq('id', staffId)
    .maybeSingle();

  if (!staff) return { ok: false, error: 'Profissional não encontrado.' };

  // Ninguem desliga o ultimo com gestao: a barbearia ficaria sem dono
  if (staff.can_manage) {
    const { count } = await admin
      .from('staff')
      .select('id', { count: 'exact', head: true })
      .eq('can_manage', true)
      .eq('active', true)
      .is('fired_at', null);

    if ((count ?? 0) <= 1) {
      return {
        ok: false,
        error:
          'Este é o último com acesso de gestão. Dê gestão a outra pessoa antes de desligar, senão ninguém mais entra no administrativo.',
      };
    }
  }

  const { error } = await admin
    .from('staff')
    .update({ active: false, fired_at: new Date().toISOString() })
    .eq('id', staffId);

  if (error) return { ok: false, error: error.message };

  const { count: cancelados } = await admin
    .from('appointments')
    .update(
      {
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancellation_reason: motivo?.trim()
          ? `Profissional desligado: ${motivo.trim()}`
          : 'Profissional desligado',
      },
      { count: 'exact' }
    )
    .eq('staff_id', staffId)
    .in('status', ['scheduled', 'confirmed'])
    .gte('start_at', new Date().toISOString());

  revalidatePath('/admin/profissionais');
  revalidatePath('/admin/agenda');
  revalidatePath('/admin');
  return { ok: true, agendamentosCancelados: cancelados ?? 0 };
}

/**
 * Apaga a ficha de vez.
 *
 * So serve para cadastro que nunca virou atendimento: nome digitado errado,
 * pessoa que desistiu antes de comecar. Quem ja atendeu nao se apaga, porque o
 * dinheiro dele esta no caixa da casa e faturamento passado nao muda sozinho.
 */
export async function excluirProfissional(staffId: string) {
  const admin = await createManagerClient();

  const pendencias = await pendenciasDoProfissional(staffId);
  if (!pendencias.podeApagarDeVez) {
    return {
      ok: false,
      error:
        'Esta pessoa já tem atendimento no histórico. Use Desligar: o que ela fez continua no caixa e o nome dela sai da operação.',
    };
  }

  const { data: staff } = await admin
    .from('staff')
    .select('id, profile_id, can_manage')
    .eq('id', staffId)
    .maybeSingle();

  if (!staff) return { ok: false, error: 'Profissional não encontrado.' };
  if (staff.can_manage) {
    return { ok: false, error: 'Tire o acesso de gestão antes de apagar a ficha.' };
  }

  // O que pode existir mesmo sem atendimento nenhum: agenda marcada, vale
  // pedido, folga combinada e a lista de servicos que ele faz.
  const { data: agendamentosDele } = await admin
    .from('appointments')
    .select('id')
    .eq('staff_id', staffId);

  const ids = (agendamentosDele ?? []).map((a) => a.id as string);
  if (ids.length) {
    await admin.from('appointment_services').delete().in('appointment_id', ids);
  }

  await admin.from('appointments').delete().eq('staff_id', staffId);
  await admin.from('allowances').delete().eq('staff_id', staffId);
  await admin.from('days_off').delete().eq('staff_id', staffId);
  await admin.from('staff_services').delete().eq('staff_id', staffId);

  const { error } = await admin.from('staff').delete().eq('id', staffId);
  if (error) return { ok: false, error: error.message };

  // A conta de acesso morre junto: ficha apagada com login vivo e porta aberta
  if (staff.profile_id) {
    await admin.auth.admin.deleteUser(staff.profile_id as string).catch(() => {});
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
