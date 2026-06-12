import { createAdminClient } from '@/lib/supabase/admin';
import { ComandasView } from './_components/comandas-view';

const BARBERSHOP_ID = '11111111-1111-1111-1111-111111111111';
const PAGE_SIZE = 10;

export const metadata = {
  title: 'Comandas',
};

interface PageProps {
  searchParams: Promise<{ periodo?: string; data?: string; pagina?: string }>;
}

export default async function ComandasPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const supabase = createAdminClient();

  // Filtro das fechadas: hoje (padrao) | todas | data especifica
  const mode: 'hoje' | 'todas' | 'data' =
    params.data ? 'data' : params.periodo === 'todas' ? 'todas' : 'hoje';
  const page = Math.max(1, Number(params.pagina ?? '1') || 1);

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

  const closedSelect = `
      id,
      customer_id,
      staff_id,
      status,
      total,
      closed_at,
      customers:customers ( full_name ),
      staff:staff ( display_name )
    `;

  // Hoje (sempre buscado: alimenta os cards de estatistica)
  const today = new Date().toLocaleDateString('en-CA', {
    timeZone: 'America/Sao_Paulo',
  });
  const todayStart = `${today}T00:00:00.000-03:00`;

  const { data: closedTodayRaw } = await supabase
    .from('comandas')
    .select(closedSelect)
    .eq('barbershop_id', BARBERSHOP_ID)
    .eq('status', 'closed')
    .gte('closed_at', todayStart)
    .order('closed_at', { ascending: false })
    .limit(100);

  // Lista filtrada exibida na secao "Fechadas"
  let closedListRaw = closedTodayRaw ?? [];
  let totalCount = (closedTodayRaw ?? []).length;
  let totalPages = 1;

  if (mode === 'data' && params.data) {
    const dayStart = `${params.data}T00:00:00.000-03:00`;
    const nextDay = new Date(`${params.data}T12:00:00Z`);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    const dayEnd = `${nextDay.toISOString().slice(0, 10)}T00:00:00.000-03:00`;

    const { data } = await supabase
      .from('comandas')
      .select(closedSelect)
      .eq('barbershop_id', BARBERSHOP_ID)
      .eq('status', 'closed')
      .gte('closed_at', dayStart)
      .lt('closed_at', dayEnd)
      .order('closed_at', { ascending: false })
      .limit(100);
    closedListRaw = data ?? [];
    totalCount = closedListRaw.length;
  } else if (mode === 'todas') {
    const from = (page - 1) * PAGE_SIZE;
    const { data, count } = await supabase
      .from('comandas')
      .select(closedSelect, { count: 'exact' })
      .eq('barbershop_id', BARBERSHOP_ID)
      .eq('status', 'closed')
      .order('closed_at', { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    closedListRaw = data ?? [];
    totalCount = count ?? 0;
    totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  }

  // Agregados (itens + forma de pagamento) das comandas visiveis
  const openIds = (openComandasRaw ?? []).map((c) => c.id);
  const closedIds = closedListRaw.map((c) => c.id);
  const allIds = [...openIds, ...closedIds];

  const itemsByComanda: Record<string, { service_total: number; product_total: number }> = {};
  const paymentByComanda: Record<string, string> = {};

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
      if (!paymentByComanda[cid]) paymentByComanda[cid] = pay.method as string;
    }
  }

  const openComandas = (openComandasRaw ?? []).map((c) => ({
    ...c,
    service_total: itemsByComanda[c.id]?.service_total ?? 0,
    product_total: itemsByComanda[c.id]?.product_total ?? 0,
    payment_method: paymentByComanda[c.id] ?? null,
  }));

  const closedList = closedListRaw.map((c) => ({
    ...c,
    payment_method: paymentByComanda[c.id] ?? null,
  }));

  const statsToday = {
    count: (closedTodayRaw ?? []).length,
    total: (closedTodayRaw ?? []).reduce((sum, c) => sum + Number(c.total ?? 0), 0),
  };

  // Dados auxiliares pra criar nova comanda
  const { data: customers } = await supabase
    .from('customers')
    .select('id, full_name, phone')
    .eq('barbershop_id', BARBERSHOP_ID)
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
      closedList={closedList as any}
      statsToday={statsToday}
      closedFilter={{
        mode,
        date: params.data ?? null,
        page,
        totalPages,
        totalCount,
      }}
      customers={customers ?? []}
      staff={staff ?? []}
    />
  );
}