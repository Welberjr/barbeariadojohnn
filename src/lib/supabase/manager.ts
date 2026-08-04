/**
 * Cliente de dados da gestao.
 *
 * Toda action do /admin passa por aqui. Pegar o cliente ja exige acesso de
 * gestao, entao nao existe caminho para uma action nova nascer desprotegida
 * por esquecimento: sem a permissao, a chamada nem chega ao banco.
 *
 * A conferencia sai do cache de requisicao do React, entao varias chamadas na
 * mesma acao custam uma consulta so.
 */
import { createAdminClient } from './admin';
import { requireCanManage, getSessionStaff } from '@/lib/staff-auth';

export async function createManagerClient() {
  await requireCanManage();
  return createAdminClient();
}

/**
 * Confirma que a pessoa pode gerir a unidade indicada, não apenas a unidade
 * atualmente escolhida no cookie. Use antes de alterar registros por ID.
 */
export async function canManageStore(barbershopId: string): Promise<boolean> {
  const staff = await getSessionStaff();
  if (!staff) return false;

  const { data } = await createAdminClient()
    .from('staff')
    .select('id')
    .eq('profile_id', staff.profileId)
    .eq('barbershop_id', barbershopId)
    .eq('can_manage', true)
    .eq('active', true)
    .is('fired_at', null)
    .maybeSingle();

  return Boolean(data);
}
