import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { exigirGestao } from '@/lib/staff-auth';
import { desdeQuandoOlhar, quandoEmPalavras, haQuantoTempo } from '@/lib/avisos';

const BARBERSHOP_ID = '11111111-1111-1111-1111-111111111111';
const STALE_COMANDA_MIN = 240; // 4h aberta = alerta

export const dynamic = 'force-dynamic';

interface NotificationItem {
  type: 'comanda' | 'stock' | 'bill' | 'appointment' | 'vale';
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
export async function GET(req: NextRequest) {
  // Alerta operacional é assunto de gestão. Estar logado não basta.
  const acesso = await exigirGestao();
  if (!acesso.ok) {
    return NextResponse.json({ error: acesso.error }, { status: 403 });
  }

  // "Novo" é desde a última vez que esta pessoa abriu o sino, que a própria
  // tela guarda. Sem essa marca, um agendamento marcado ontem apareceria como
  // novidade para sempre e o sino viraria enfeite que ninguém lê.
  const desde = desdeQuandoOlhar(req.nextUrl.searchParams.get('desde'));

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

  const [comandasRes, productsRes, billsRes, valesRes, novosRes] = await Promise.all([
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
    // Vales pedidos pelo painel do barbeiro, aguardando resposta
    admin
      .from('allowances')
      .select('id, amount, requested_at, staff:staff(display_name)')
      .eq('barbershop_id', BARBERSHOP_ID)
      .eq('status', 'pending')
      .order('requested_at')
      .limit(10),
    // Horários que o cliente marcou sozinho pelo aplicativo. Marcação feita
    // aqui dentro não entra: quem digitou já sabe que digitou.
    admin
      .from('appointments')
      .select(
        'id, start_at, created_at, customers:customers(full_name), staff:staff(display_name)'
      )
      .eq('barbershop_id', BARBERSHOP_ID)
      // 'public_site' é o que o aplicativo do cliente grava. O enum do banco
      // tem só manual, whatsapp e public_site: inventar outro valor aqui faz a
      // consulta inteira falhar em silêncio e o sino ficar vazio para sempre.
      .eq('source', 'public_site')
      .neq('status', 'cancelled')
      .gte('created_at', desde)
      .order('created_at', { ascending: false })
      .limit(10),
  ]);

  // Agendamentos restantes de hoje. Tenta incluir 'confirmed';
  // se o enum do banco ainda nao tiver esse valor, cai para apenas 'scheduled'.
  let aptsRes = await admin
    .from('appointments')
    .select('id', { count: 'exact', head: true })
    .eq('barbershop_id', BARBERSHOP_ID)
    .in('status', ['scheduled', 'confirmed'])
    .gte('start_at', nowIso)
    .lte('start_at', dayEnd);
  if (aptsRes.error) {
    aptsRes = await admin
      .from('appointments')
      .select('id', { count: 'exact', head: true })
      .eq('barbershop_id', BARBERSHOP_ID)
      .eq('status', 'scheduled')
      .gte('start_at', nowIso)
      .lte('start_at', dayEnd);
  }

  const items: NotificationItem[] = [];

  // 0. Cliente marcou sozinho. Fica no topo porque é a única linha da lista que
  // conta uma novidade: o resto é situação que continua igual até alguém
  // resolver.
  for (const a of novosRes.data ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const relCliente = a.customers as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const relStaff = a.staff as any;
    const cliente = Array.isArray(relCliente)
      ? relCliente[0]?.full_name
      : relCliente?.full_name;
    const profissional = Array.isArray(relStaff)
      ? relStaff[0]?.display_name
      : relStaff?.display_name;

    const dia = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
    }).format(new Date(a.start_at as string));

    items.push({
      type: 'appointment',
      severity: 'info',
      title: `${cliente ?? 'Cliente'} marcou pelo aplicativo`,
      subtitle: `${quandoEmPalavras(a.start_at as string)}${
        profissional ? ` com ${profissional}` : ''
      } · ${haQuantoTempo(a.created_at as string)}`,
      href: `/admin/agenda?date=${dia}`,
    });
  }

  // 1. Vale aguardando resposta: o barbeiro está esperando alguém decidir
  for (const vale of valesRes.data ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rel = vale.staff as any;
    const nome = Array.isArray(rel) ? rel[0]?.display_name : rel?.display_name;
    const valor = Number(vale.amount ?? 0).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
    items.push({
      type: 'vale',
      severity: 'warn',
      title: `Pedido de vale de ${nome ?? 'profissional'}`,
      subtitle: `${valor} aguardando sua resposta`,
      href: '/admin/financeiro#vales',
    });
  }

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
