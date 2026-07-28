/**
 * Portaria da equipe: resolve quem esta logado, se e da equipe e o que pode.
 *
 * Espelha o src/lib/customer-auth.ts, que ja faz o mesmo para o cliente.
 *
 * REGRA DE OURO: o staff_id usado em qualquer leitura ou escrita do painel sai
 * daqui, nunca de parametro de URL, campo escondido ou estado do navegador.
 * Nenhuma funcao deste arquivo aceita staff_id de fora.
 *
 * A conferencia acontece no banco a cada requisicao, de proposito: e o que faz
 * um profissional desligado perder o acesso na hora, sem depender de o token
 * dele expirar.
 */
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  parseStaffPermissions,
  podeModulo,
  type Modulo,
  type Permissoes,
} from '@/lib/staff-permissions';

export interface SessionStaff {
  staffId: string;
  profileId: string;
  userId: string;
  displayName: string;
  fullName: string | null;
  email: string | null;
  role: string;
  canManage: boolean;
  permissions: Permissoes;
  mustChangePassword: boolean;
  commissionPercent: number;
  active: boolean;
}

const CAMPOS_STAFF =
  'id, profile_id, display_name, role, active, fired_at, can_manage, permissions, must_change_password, default_commission_percent';

/**
 * Resolve o profissional logado. Devolve nulo quando nao ha sessao de equipe.
 * Use em server actions, onde redirecionar atrapalha o tratamento de erro.
 *
 * Envolvido em cache() do React: varias guardas na mesma requisicao custam
 * uma consulta so, sem abrir mao de conferir no banco a cada requisicao.
 */
export const getSessionStaff = cache(async function getSessionStaff(): Promise<SessionStaff | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;
  // Cliente do painel do cliente nunca e equipe
  if (user.user_metadata?.role === 'customer') return null;

  const admin = createAdminClient();
  const { data: staff } = await admin
    .from('staff')
    .select(CAMPOS_STAFF)
    .eq('profile_id', user.id)
    .eq('active', true)
    .is('fired_at', null)
    .maybeSingle();

  if (!staff) return null;

  const { data: profile } = await admin
    .from('profiles')
    .select('full_name, email')
    .eq('id', user.id)
    .maybeSingle();

  return {
    staffId: staff.id as string,
    profileId: staff.profile_id as string,
    userId: user.id,
    displayName: (staff.display_name as string) ?? profile?.full_name ?? 'Profissional',
    fullName: (profile?.full_name as string) ?? null,
    email: (profile?.email as string) ?? user.email ?? null,
    role: (staff.role as string) ?? 'barber',
    canManage: staff.can_manage === true,
    permissions: parseStaffPermissions(staff.permissions),
    mustChangePassword: staff.must_change_password === true,
    commissionPercent: Number(staff.default_commission_percent ?? 0),
    active: true,
  };
});

/**
 * Exige profissional logado, opcionalmente com um modulo liberado.
 * Use nas paginas do painel.
 *
 * `ignorarTrocaSenha` existe para o layout do painel e para a propria tela de
 * perfil: as duas moram dentro do painel, entao forcar a troca ali criaria um
 * laco de redirecionamento. Quem obriga a troca sao as demais paginas.
 */
export async function requireStaff(
  modulo?: Modulo,
  opts: { ignorarTrocaSenha?: boolean } = {}
): Promise<SessionStaff> {
  const staff = await getSessionStaff();

  if (!staff) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    // Cliente logado vai para a area dele; qualquer outro caso volta ao login
    if (user?.user_metadata?.role === 'customer') redirect('/cliente');
    redirect('/login');
  }

  // Senha entregue pelo gestor: nada de painel antes de trocar
  if (staff.mustChangePassword && !opts.ignorarTrocaSenha) {
    redirect('/painel/perfil?trocar=1');
  }

  if (modulo && !podeModulo(staff, modulo)) redirect('/painel');

  return staff;
}

/**
 * Exige acesso de gestao. Use no /admin: no layout e no inicio de toda
 * server action que altera dado.
 */
export async function requireCanManage(): Promise<SessionStaff> {
  const staff = await getSessionStaff();

  if (!staff) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user?.user_metadata?.role === 'customer') redirect('/cliente');
    redirect('/login');
  }

  if (!staff.canManage) redirect('/painel');

  return staff;
}

/**
 * Variante para server actions do painel: devolve o erro em vez de redirecionar,
 * para a tela conseguir mostrar a mensagem.
 */
export async function exigirModulo(
  modulo: Modulo
): Promise<{ ok: true; staff: SessionStaff } | { ok: false; error: string }> {
  const staff = await getSessionStaff();
  if (!staff) return { ok: false, error: 'Sessão expirada. Entre de novo.' };
  if (staff.mustChangePassword) {
    return { ok: false, error: 'Troque a senha antes de usar o painel.' };
  }
  if (!podeModulo(staff, modulo)) {
    return { ok: false, error: 'Você não tem acesso a esta função.' };
  }
  return { ok: true, staff };
}

/** Variante de requireCanManage para server actions do admin. */
export async function exigirGestao(): Promise<
  { ok: true; staff: SessionStaff } | { ok: false; error: string }
> {
  const staff = await getSessionStaff();
  if (!staff) return { ok: false, error: 'Sessão expirada. Entre de novo.' };
  if (!staff.canManage) return { ok: false, error: 'Você não tem acesso de gestão.' };
  return { ok: true, staff };
}
