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
import { requireCanManage } from '@/lib/staff-auth';

export async function createManagerClient() {
  await requireCanManage();
  return createAdminClient();
}
