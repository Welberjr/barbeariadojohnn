import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

const BARBERSHOP_ID = '11111111-1111-1111-1111-111111111111';

export const dynamic = 'force-dynamic';

/**
 * Busca global do painel admin: clientes, serviços e agendamentos.
 * Protegida por sessão (mesmo login do painel).
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') ?? '').trim();
  if (q.length < 2) {
    return NextResponse.json({ customers: [], services: [], appointments: [] });
  }

  const admin = createAdminClient();
  const like = `%${q}%`;

  const [customersRes, servicesRes] = await Promise.all([
    admin
      .from('customers')
      .select('id, full_name, phone')
      .eq('barbershop_id', BARBERSHOP_ID)
      .or(`full_name.ilike.${like},phone.ilike.${like},email.ilike.${like}`)
      .order('full_name')
      .limit(5),
    admin
      .from('services')
      .select('id, name, base_price')
      .eq('barbershop_id', BARBERSHOP_ID)
      .ilike('name', like)
      .order('name')
      .limit(5),
  ]);

  const customers = (customersRes.data ?? []).map((c) => ({
    id: c.id as string,
    full_name: (c.full_name as string) ?? 'Sem nome',
    phone: (c.phone as string | null) ?? null,
  }));

  const services = (servicesRes.data ?? []).map((s) => ({
    id: s.id as string,
    name: s.name as string,
    base_price: Number(s.base_price ?? 0),
  }));

  // Proximos agendamentos dos clientes encontrados
  let appointments: {
    id: string;
    start_at: string;
    customer_name: string;
  }[] = [];

  const customerIds = customers.map((c) => c.id);
  if (customerIds.length > 0) {
    const { data: apts } = await admin
      .from('appointments')
      .select('id, start_at, customer_id, customers:customers(full_name)')
      .eq('barbershop_id', BARBERSHOP_ID)
      .in('customer_id', customerIds)
      .gte('start_at', new Date().toISOString())
      .order('start_at')
      .limit(5);

    appointments = (apts ?? []).map((a) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rel = a.customers as any;
      const name = Array.isArray(rel) ? rel[0]?.full_name : rel?.full_name;
      return {
        id: a.id as string,
        start_at: a.start_at as string,
        customer_name: (name as string) ?? 'Cliente',
      };
    });
  }

  return NextResponse.json({ customers, services, appointments });
}
