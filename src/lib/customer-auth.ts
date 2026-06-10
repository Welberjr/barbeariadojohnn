/**
 * Autenticacao do painel do cliente.
 *
 * Clientes tem usuario no Supabase Auth (user_metadata.role = 'customer')
 * vinculado a customers.auth_user_id. Staff/admin continuam no fluxo /login.
 */
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

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

/**
 * Resolve o cliente logado. Redireciona quando nao ha sessao de cliente:
 *  - sem sessao -> /cliente/login
 *  - sessao de staff (sem registro de cliente) -> /admin
 */
export async function requireCustomer(): Promise<{
  customer: PanelCustomer;
  userId: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/cliente/login');

  const admin = createAdminClient();
  const { data: customer } = await admin
    .from('customers')
    .select(
      'id, full_name, phone, email, photo_url, birth_date, loyalty_points, loyalty_tier, total_appointments, total_spent, created_at, active'
    )
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (!customer || customer.active === false) {
    // Usuario logado sem cadastro de cliente: provavelmente equipe
    redirect('/admin');
  }

  return { customer: customer as unknown as PanelCustomer, userId: user.id };
}

/**
 * Variante para server actions: retorna null em vez de redirecionar.
 */
export async function getSessionCustomer(): Promise<PanelCustomer | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const { data: customer } = await admin
    .from('customers')
    .select(
      'id, full_name, phone, email, photo_url, birth_date, loyalty_points, loyalty_tier, total_appointments, total_spent, created_at, active'
    )
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (!customer || customer.active === false) return null;
  return customer as unknown as PanelCustomer;
}
