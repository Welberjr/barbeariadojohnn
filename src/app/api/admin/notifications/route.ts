import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

const BARBERSHOP_ID = '11111111-1111-1111-1111-111111111111';
const STALE_COMANDA_MIN = 240; // 4h aberta = alerta

export const dynamic = 'force-dynamic';

interface NotificationItem {
  type: 'comanda' | 'stock' | 'bill' | 'appointment';
  severity: 'danger' | 'warn' | 'info';
  title: string;
  subtitle: string;
  href: string;
}

function fmtElapsed(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
}

/**
 * Notificações operacionais do painel:
 * comandas abertas há muito tempo, estoque baixo,
 * contas a pagar vencendo/vencidas e agendamentos restantes do dia.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Nao autorizado' }, { status: 401 });
  }

  const admin = createAdminClient();
  const nowMs = Date.now();
  const nowIso = new Date().toISOString();
  const todayStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
  }).format(new Date());
  const plus7Str = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(nowMs + 7 * 86400000));
  const dayEnd = `${todayStr}T23:59:59.999-03:00`;

  const [comandasRes, productsRes, billsRes, aptsRes] = await Promise.all([
    admin
      .from('comandas')
      .select('id, opened_at, customers:customers(full_name)')
      .eq('barbershop_id', BARBERSHOP_ID)
      .eq('status', 'open')
      .order('opened_at'),
    admin
      .from('products')
      .select('id, name, stock_current, stock_minimum')
      .eq('barbershop_id', BARBERSHOP_ID)
      .eq('active', true),
    admin
      .from('bills')
      .select('id, description, due_date, amount')
      .eq('barbershop_id', BARBERSHOP_ID)
      .eq('status', 'pending')
      .lte('due_date', plus7Str)
      .order('due_date')
      .limit(10),
    admin
      .from('appointments')
      .select('id', { count: 'exact', head: true })
      .eq('barbershop_id', BARBERSHOP_ID)
      .in('status', ['scheduled', 'confirmed'])
      .gte('start_at', nowIso)
      .lte('start_at', dayEnd),
  ]);

  const items: NotificationItem[] = [];

  // 1. Comandas abertas há muito tempo
  const staleComandas = (comandasRes.data ?? []).filter((c) => {
    const elapsed = (nowMs - new Date(c.opened_at as string).getTime()) / 60000;
    return elapsed > STALE_COMANDA_MIN;
  });
  for (const c of staleComandas.slice(0, 3)) {
    const elapsed = Math.floor(
      (nowMs - new Date(c.opened_at as string).getTime()) / 60000
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rel = c.customers as any;
    const name = Array.isArray(rel) ? rel[0]?.full_name : rel?.full_name;
    items.push({
      type: 'comanda',
      severity: 'warn',
      title: `Comanda aberta há ${fmtElapsed(elapsed)}`,
      subtitle: (name as string) ?? 'Cliente',
      href: `/admin/comandas/${c.id}`,
    });
  }
  if (staleComandas.length > 3) {
    items.push({
      type: 'comanda',
      severity: 'warn',
      title: `+${staleComandas.length - 3} comandas antigas em aberto`,
      subtitle: 'Toque para revisar todas',
      href: '/admin/comandas',
    });
  }

  // 2. Estoque baixo (agregado)
  const lowStock = (productsRes.data ?? []).filter(
    (p) => Number(p.stock_current ?? 0) <= Number(p.stock_minimum ?? 0)
  );
  if (lowStock.length > 0) {
    const names = lowStock
      .slice(0, 3)
      .map((p) => p.name as string)
      .join(', ');
    items.push({
      type: 'stock',
      severity: 'danger',
      title: `${lowStock.length} ${lowStock.length === 1 ? 'produto' : 'produtos'} com estoque baixo`,
      subtitle: names + (lowStock.length > 3 ? '...' : ''),
      href: '/admin/produtos',
    });
  }

  // 3. Contas a pagar (vencidas e vencendo em 7 dias)
  for (const b of (billsRes.data ?? []).slice(0, 3)) {
    const due = b.due_date as string;
    const overdue = due < todayStr;
    const dueLabel = new Date(due + 'T12:00:00').toLocaleDateString('pt-BR');
    items.push({
      type: 'bill',
      severity: overdue ? 'danger' : 'warn',
      title: overdue
        ? `Conta vencida em ${dueLabel}`
        : `Conta vence em ${dueLabel}`,
      subtitle: (b.description as string) ?? 'Conta a pagar',
      href: '/admin/contas-pagar',
    });
  }

  // 4. Agendamentos restantes hoje (agregado)
  const remaining = aptsRes.count ?? 0;
  if (remaining > 0) {
    items.push({
      type: 'appointment',
      severity: 'info',
      title: `${remaining} ${remaining === 1 ? 'agendamento restante' : 'agendamentos restantes'} hoje`,
      subtitle: 'Confira a agenda do dia',
      href: '/admin/agenda',
    });
  }

  return NextResponse.json({ count: items.length, items });
}
