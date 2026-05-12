import { createClient } from '@/lib/supabase/server';
import { ComandasView } from './_components/comandas-view';

const BARBERSHOP_ID = '11111111-1111-1111-1111-111111111111';

export const metadata = {
  title: 'Comandas',
};

export default async function ComandasPage() {
  const supabase = await createClient();

  // Comandas abertas
  const { data: openComandas } = await supabase
    .from('comandas')
    .select(
      `
      id,
      customer_id,
      staff_id,
      status,
      total,
      subtotal,
      service_total,
      product_total,
      opened_at,
      payment_method,
      customers:customers ( full_name, phone ),
      staff:staff ( display_name )
    `
    )
    .eq('barbershop_id', BARBERSHOP_ID)
    .eq('status', 'open')
    .order('opened_at', { ascending: false });

  // Comandas fechadas hoje
  const today = new Date().toISOString().split('T')[0];
  const todayStart = `${today}T00:00:00.000-03:00`;

  const { data: closedToday } = await supabase
    .from('comandas')
    .select(
      `
      id,
      customer_id,
      staff_id,
      status,
      total,
      payment_method,
      closed_at,
      customers:customers ( full_name ),
      staff:staff ( display_name )
    `
    )
    .eq('barbershop_id', BARBERSHOP_ID)
    .eq('status', 'closed')
    .gte('closed_at', todayStart)
    .order('closed_at', { ascending: false })
    .limit(50);

  // Dados auxiliares pra criar nova comanda
  const { data: customers } = await supabase
    .from('customers')
    .select('id, full_name, phone')
    .eq('active', true)
    .order('full_name')
    .limit(500);

  const { data: staff } = await supabase
    .from('staff')
    .select('id, display_name, role')
    .eq('active', true)
    .in('role', ['barber', 'owner', 'manager'])
    .order('display_name');

  return (
    <ComandasView
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      openComandas={(openComandas ?? []) as any}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      closedToday={(closedToday ?? []) as any}
      customers={customers ?? []}
      staff={staff ?? []}
    />
  );
}
