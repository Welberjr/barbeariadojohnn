import { createClient } from '@/lib/supabase/server';
import { ComandasView } from './_components/comandas-view';

const BARBERSHOP_ID = '11111111-1111-1111-1111-111111111111';

export const metadata = {
  title: 'Comandas',
};

export default async function ComandasPage() {
  const supabase = await createClient();

  // Comandas abertas
  const { data: openComandasRaw } = await supabase
    .from('comandas')
    .select(
      `
      id,
      customer_id,
      staff_id,
      status,
      total,
      subtotal,
      opened_at,
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

  const { data: closedTodayRaw } = await supabase
    .from('comandas')
    .select(
      `
      id,
      customer_id,
      staff_id,
      status,
      total,
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

  // Para cada comanda, agregar items (services/products totals) e payment_method
  const openIds = (openComandasRaw ?? []).map((c) => c.id);
  const closedIds = (closedTodayRaw ?? []).map((c) => c.id);
  const allIds = [...openIds, ...closedIds];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let itemsByComanda: Record<string, { service_total: number; product_total: number }> = {};
  let paymentByComanda: Record<string, string> = {};

  if (allIds.length > 0) {
    const [{ data: itemsAgg }, { data: paymentsAgg }] = await Promise.all([
      supabase
        .from('comanda_items')
        .select('comanda_id, item_type, total_price')
        .in('comanda_id', allIds),
      supabase
        .from('comanda_payments')
        .select('comanda_id, method')
        .in('comanda_id', allIds),
    ]);

    for (const item of itemsAgg ?? []) {
      const cid = item.comanda_id as string;
      if (!itemsByComanda[cid]) {
        itemsByComanda[cid] = { service_total: 0, product_total: 0 };
      }
      const val = Number(item.total_price);
      if (item.item_type === 'service') itemsByComanda[cid].service_total += val;
      else if (item.item_type === 'product') itemsByComanda[cid].product_total += val;
    }

    for (const pay of paymentsAgg ?? []) {
      const cid = pay.comanda_id as string;
      // pega primeiro pagamento (se houver vários, prevalece o primeiro encontrado)
      if (!paymentByComanda[cid]) paymentByComanda[cid] = pay.method as string;
    }
  }

  // Anexa nas comandas
  const openComandas = (openComandasRaw ?? []).map((c) => ({
    ...c,
    service_total: itemsByComanda[c.id]?.service_total ?? 0,
    product_total: itemsByComanda[c.id]?.product_total ?? 0,
    payment_method: paymentByComanda[c.id] ?? null,
  }));

  const closedToday = (closedTodayRaw ?? []).map((c) => ({
    ...c,
    payment_method: paymentByComanda[c.id] ?? null,
  }));

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
      openComandas={openComandas as any}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      closedToday={closedToday as any}
      customers={customers ?? []}
      staff={staff ?? []}
    />
  );
}
