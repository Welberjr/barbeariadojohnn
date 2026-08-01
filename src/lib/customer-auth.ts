/**
 * Autenticacao do painel do cliente.
 *
 * Clientes tem usuario no Supabase Auth (user_metadata.role = 'customer')
 * vinculado a customers.auth_user_id. Staff/admin continuam no fluxo /login.
 */
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { findSingleUnlinkedCustomerForEmail } from '@/lib/customer-auth-link';

export interface PanelCustomer {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  photo_url: string | null;
  birth_date: string | null;
  loyalty_points: number;
  loyalty_tier: string | null;
  total_appointments: number;
  total_spent: number;
  created_at: string;
}

const CUSTOMER_FIELDS =
  'id, full_name, phone, email, photo_url, birth_date, loyalty_points, loyalty_tier, total_appointments, total_spent, created_at, active';

/**
 * Resolve a sessão uma única vez por renderização no servidor. O layout e a
 * página filha normalmente chamam requireCustomer(); sem cache, cada troca de
 * aba fazia duas validações no Auth e duas leituras do cadastro.
 */
const getCustomerSession = cache(async function getCustomerSession(): Promise<{
  customer: PanelCustomer | null;
  userId: string | null;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { customer: null, userId: null };

  const admin = createAdminClient();
  let { data: customer } = await admin
    .from('customers')
    .select(CUSTOMER_FIELDS)
    .eq('auth_user_id', user.id)
    .maybeSingle();

  // A importacao de clientes reais preservou as contas do Auth, mas os
  // cadastros recriados ainda nao tinham auth_user_id. Recuperamos esse
  // vinculo no primeiro acesso apenas quando o e-mail e unico e a conta nao
  // pertence a equipe, evitando associar uma pessoa errada.
  if (!customer && user.email) {
    const { data: staff } = await admin
      .from('staff')
      .select('id')
      .eq('profile_id', user.id)
      .limit(1);

    if (!staff?.length) {
      const { data: unlinkedCustomers } = await admin
        .from('customers')
        .select(`${CUSTOMER_FIELDS}, auth_user_id`)
        .eq('active', true)
        .is('auth_user_id', null);

      const match = findSingleUnlinkedCustomerForEmail(
        unlinkedCustomers ?? [],
        user.email
      );

      if (match) {
        const { data: linkedCustomer } = await admin
          .from('customers')
          .update({ auth_user_id: user.id })
          .eq('id', match.id)
          .is('auth_user_id', null)
          .select(CUSTOMER_FIELDS)
          .maybeSingle();

        customer = linkedCustomer;
      }
    }
  }

  if (!customer || customer.active === false) {
    return { customer: null, userId: user.id };
  }

  return {
    customer: customer as unknown as PanelCustomer,
    userId: user.id,
  };
});

/**
 * Resolve o cliente logado. Redireciona quando nao ha sessao de cliente:
 *  - sem sessao -> /cliente/login
 *  - sessao de staff (sem registro de cliente) -> /admin
 */
export async function requireCustomer(): Promise<{
  customer: PanelCustomer;
  userId: string;
}> {
  const session = await getCustomerSession();

  if (!session.userId) redirect('/cliente/login');

  if (!session.customer) {
    // Logado, sem ficha de cliente ligada a este login. Quase sempre e alguem
    // da equipe entrando aqui pela primeira vez: manda para o proprio perfil,
    // que e onde se liga a ficha de cliente ao mesmo login.
    const { data: daEquipe } = await createAdminClient()
      .from('staff')
      .select('id')
      .eq('profile_id', session.userId)
      .eq('active', true)
      .is('fired_at', null)
      .maybeSingle();

    // Sem ficha e sem trabalho na casa: a sessao existe, mas nao tem dono aqui.
    // O aviso na tela de login evita a pessoa ficar tentando entrar de novo com
    // a mesma conta sem entender por que nao abre.
    redirect(daEquipe ? '/painel/perfil' : '/cliente/login?sem-cadastro=1');
  }

  return { customer: session.customer, userId: session.userId };
}

/**
 * Variante para server actions: retorna null em vez de redirecionar.
 */
export async function getSessionCustomer(): Promise<PanelCustomer | null> {
  return (await getCustomerSession()).customer;
}
