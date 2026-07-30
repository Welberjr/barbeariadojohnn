/**
 * Camada de dados do painel do barbeiro.
 *
 * REGRA DE OURO: toda funcao aqui recebe o SessionStaff resolvido pela
 * portaria e filtra pelo staff.staffId dela. Nenhuma funcao aceita um
 * identificador de profissional vindo de fora, entao nao existe caminho para
 * um barbeiro pedir o dado do outro trocando a URL.
 *
 * Os recortes de periodo e de comissao seguem exatamente o que o /admin ja
 * faz, para o numero do barbeiro bater com o numero do gestor: comanda
 * fechada, por closed_at, e comissao pelo valor realizado em
 * comanda_items.commission_value (nunca recalculada pelo percentual de hoje).
 */
import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import type { SessionStaff } from '@/lib/staff-auth';
import { splitPool, toCents, centsToBRL } from '@/lib/subscriptions';
import type { AssinaturaResumo } from './assinatura-selo';

export const BARBERSHOP_ID = '11111111-1111-1111-1111-111111111111';

/** Inicio e fim do dia no fuso da barbearia. */
export function limitesDoDia(dateStr: string) {
  return {
    inicio: `${dateStr}T00:00:00.000-03:00`,
    fim: `${dateStr}T23:59:59.999-03:00`,
  };
}

/** Data de hoje (yyyy-mm-dd) no fuso da barbearia. */
export function hojeStr(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
  }).format(new Date());
}

// ------------------------------------------------------------------
// Assinaturas
// ------------------------------------------------------------------

/**
 * Resolve a assinatura de varios clientes de uma vez.
 * Duas consultas no total, em vez de duas por cliente: numa agenda cheia isso
 * e a diferenca entre a tela abrir na hora e o barbeiro esperar.
 */
export async function assinaturasPorCliente(
  customerIds: string[]
): Promise<Map<string, AssinaturaResumo>> {
  const mapa = new Map<string, AssinaturaResumo>();
  const ids = [...new Set(customerIds.filter(Boolean))];
  if (ids.length === 0) return mapa;

  const admin = createAdminClient();

  const { data: subs } = await admin
    .from('subscriptions')
    .select(
      `id, customer_id, status, current_period_end,
       plan:subscription_plans ( name, included_uses, allowed_days )`
    )
    .in('customer_id', ids)
    .in('status', ['active', 'past_due']);

  if (!subs?.length) return mapa;

  const { data: usos } = await admin
    .from('subscription_usages')
    .select('subscription_id')
    .in(
      'subscription_id',
      subs.map((s) => s.id as string)
    )
    .is('settled_payout_id', null);

  const usosPorAssinatura = new Map<string, number>();
  for (const u of usos ?? []) {
    const sid = u.subscription_id as string;
    usosPorAssinatura.set(sid, (usosPorAssinatura.get(sid) ?? 0) + 1);
  }

  const agora = new Date();

  for (const sub of subs) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const plano = sub.plan as any;
    if (!plano) continue;

    const incluidos = Number(plano.included_uses ?? 0);
    const usados = usosPorAssinatura.get(sub.id as string) ?? 0;

    mapa.set(sub.customer_id as string, {
      planoNome: plano.name as string,
      usosIncluidos: incluidos,
      usosNoCiclo: usados,
      usosRestantes: Math.max(0, incluidos - usados),
      fimDoCiclo: sub.current_period_end as string,
      diasPermitidos: (plano.allowed_days ?? null) as number[] | null,
      vencida: agora > new Date(sub.current_period_end as string),
    });
  }

  return mapa;
}

// ------------------------------------------------------------------
// Agenda
// ------------------------------------------------------------------

export interface AgendamentoPainel {
  id: string;
  customerId: string | null;
  cliente: string;
  telefone: string | null;
  inicio: string;
  fim: string;
  status: string;
  servicos: string[];
  observacao: string | null;
  comandaId: string | null;
  assinatura: AssinaturaResumo | null;
}

export async function agendaDoDia(
  staff: SessionStaff,
  dateStr: string
): Promise<AgendamentoPainel[]> {
  const admin = createAdminClient();
  const { inicio, fim } = limitesDoDia(dateStr);

  const { data: agendamentos } = await admin
    .from('appointments')
    .select(
      `id, customer_id, start_at, end_at, status, notes, comanda_id,
       customers:customers ( full_name, phone )`
    )
    .eq('barbershop_id', BARBERSHOP_ID)
    .eq('staff_id', staff.staffId)
    .gte('start_at', inicio)
    .lte('start_at', fim)
    .order('start_at');

  const lista = agendamentos ?? [];
  if (lista.length === 0) return [];

  const [{ data: servicosRaw }, assinaturas] = await Promise.all([
    admin
      .from('appointment_services')
      .select('appointment_id, services:services ( name )')
      .in(
        'appointment_id',
        lista.map((a) => a.id as string)
      ),
    assinaturasPorCliente(lista.map((a) => a.customer_id as string)),
  ]);

  const servicosPorAgendamento = new Map<string, string[]>();
  for (const s of servicosRaw ?? []) {
    const apptId = s.appointment_id as string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nome = (s.services as any)?.name as string | undefined;
    if (!nome) continue;
    servicosPorAgendamento.set(apptId, [
      ...(servicosPorAgendamento.get(apptId) ?? []),
      nome,
    ]);
  }

  return lista.map((a) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cliente = a.customers as any;
    return {
      id: a.id as string,
      customerId: (a.customer_id as string) ?? null,
      cliente: cliente?.full_name ?? 'Cliente avulso',
      telefone: cliente?.phone ?? null,
      inicio: a.start_at as string,
      fim: a.end_at as string,
      status: a.status as string,
      servicos: servicosPorAgendamento.get(a.id as string) ?? [],
      observacao: (a.notes as string) ?? null,
      comandaId: (a.comanda_id as string) ?? null,
      assinatura: a.customer_id
        ? assinaturas.get(a.customer_id as string) ?? null
        : null,
    };
  });
}

// ------------------------------------------------------------------
// Financeiro
// ------------------------------------------------------------------

export interface FinanceiroPainel {
  producaoServicos: number;
  producaoProdutos: number;
  producaoTotal: number;
  comissao: number;
  atendimentos: number;
  ticketMedio: number;
  valesDescontados: number;
  liquido: number;
  jaPago: number;
  assinaturaAtendimentos: number;
  assinaturaPotinhoPago: number;
  assinaturaPotinhoEstimado: number;
}

export async function financeiroDoPeriodo(
  staff: SessionStaff,
  fromStr: string,
  toStr: string
): Promise<FinanceiroPainel> {
  const admin = createAdminClient();
  const inicio = `${fromStr}T00:00:00.000-03:00`;
  const fim = `${toStr}T23:59:59.999-03:00`;

  // Nenhuma consulta depende da outra, entao as seis vao juntas: e o que faz
  // a aba Financeiro (e o Hoje) abrir de uma vez em vez de esperar em fila.
  const [
    { data: comandas },
    { data: itens },
    { data: vales },
    { data: payouts },
    { data: usos },
    { data: potinhoItens },
  ] = await Promise.all([
    admin
      .from('comandas')
      .select('id')
      .eq('barbershop_id', BARBERSHOP_ID)
      .eq('staff_id', staff.staffId)
      .eq('status', 'closed')
      .gte('closed_at', inicio)
      .lte('closed_at', fim),
    // Os itens sao filtrados pelo staff do ITEM: numa comanda de outro
    // profissional, o barbeiro so leva o que ele mesmo executou.
    admin
      .from('comanda_items')
      .select('item_type, total_price, commission_value, comanda_id')
      .eq('barbershop_id', BARBERSHOP_ID)
      .eq('staff_id', staff.staffId)
      .gte('created_at', inicio)
      .lte('created_at', fim),
    admin
      .from('allowances')
      .select('amount, status, requested_at')
      .eq('barbershop_id', BARBERSHOP_ID)
      .eq('staff_id', staff.staffId)
      .eq('status', 'approved')
      .gte('requested_at', inicio)
      .lte('requested_at', fim),
    admin
      .from('commission_payouts')
      .select('amount_paid, payment_date')
      .eq('barbershop_id', BARBERSHOP_ID)
      .eq('staff_id', staff.staffId)
      .gte('payment_date', fromStr)
      .lte('payment_date', toStr),
    admin
      .from('subscription_usages')
      .select('id, subscription_id, settled_payout_id')
      .eq('barbershop_id', BARBERSHOP_ID)
      .eq('staff_id', staff.staffId)
      .gte('used_at', inicio)
      .lte('used_at', fim),
    admin
      .from('subscription_payout_items')
      .select('amount, created_at')
      .eq('barbershop_id', BARBERSHOP_ID)
      .eq('staff_id', staff.staffId)
      .gte('created_at', inicio)
      .lte('created_at', fim),
  ]);

  const comandaIds = (comandas ?? []).map((c) => c.id as string);

  let producaoServicos = 0;
  let producaoProdutos = 0;
  let comissao = 0;

  for (const item of itens ?? []) {
    const valor = Number(item.total_price ?? 0);
    comissao += Number(item.commission_value ?? 0);
    if (item.item_type === 'service') producaoServicos += valor;
    else producaoProdutos += valor;
  }

  const valesDescontados = (vales ?? []).reduce((s, v) => s + Number(v.amount ?? 0), 0);
  const jaPago = (payouts ?? []).reduce((s, p) => s + Number(p.amount_paid ?? 0), 0);
  const assinaturaPotinhoPago = (potinhoItens ?? []).reduce(
    (s, p) => s + Number(p.amount ?? 0),
    0
  );

  const usosAbertos = (usos ?? []).filter((u) => !u.settled_payout_id);
  const assinaturaPotinhoEstimado = await estimarPotinhoEmAberto(staff, usosAbertos);

  const atendimentos = comandaIds.length;
  const producaoTotal = producaoServicos + producaoProdutos;

  return {
    producaoServicos,
    producaoProdutos,
    producaoTotal,
    comissao,
    atendimentos,
    ticketMedio: atendimentos > 0 ? producaoTotal / atendimentos : 0,
    valesDescontados,
    liquido: comissao - valesDescontados,
    jaPago,
    assinaturaAtendimentos: (usos ?? []).length,
    assinaturaPotinhoPago,
    assinaturaPotinhoEstimado,
  };
}

/**
 * Estimativa do potinho dos ciclos ainda abertos.
 *
 * Usa a mesma funcao de rateio do fechamento (splitPool), entao a estimativa
 * e consistente com o que sera pago. Continua sendo estimativa: se um colega
 * atender o mesmo assinante antes do fechamento, a fatia de cada um muda. A
 * tela deixa isso escrito.
 */
async function estimarPotinhoEmAberto(
  staff: SessionStaff,
  usosAbertos: Array<{ subscription_id: string }>
): Promise<number> {
  if (usosAbertos.length === 0) return 0;

  const admin = createAdminClient();
  const subscriptionIds = [...new Set(usosAbertos.map((u) => u.subscription_id))];

  const [{ data: subs }, { data: todosUsos }] = await Promise.all([
    admin
      .from('subscriptions')
      .select('id, current_price, plan:subscription_plans ( price, barber_share_percent )')
      .in('id', subscriptionIds),
    admin
      .from('subscription_usages')
      .select('subscription_id, staff_id')
      .in('subscription_id', subscriptionIds)
      .is('settled_payout_id', null),
  ]);

  let total = 0;

  for (const sub of subs ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const plano = sub.plan as any;
    const preco = Number(sub.current_price ?? plano?.price ?? 0);
    const share = Number(plano?.barber_share_percent ?? 0);
    if (preco <= 0 || share <= 0) continue;

    const usosDoCiclo = (todosUsos ?? []).filter(
      (u) => u.subscription_id === sub.id
    );
    if (usosDoCiclo.length === 0) continue;

    const porStaff = new Map<string, number>();
    for (const u of usosDoCiclo) {
      const sid = u.staff_id as string;
      if (!sid) continue;
      porStaff.set(sid, (porStaff.get(sid) ?? 0) + 1);
    }

    const poolCents = Math.round(toCents(preco) * (share / 100));
    const fatias = splitPool(
      poolCents,
      Array.from(porStaff.entries()).map(([staff_id, uses]) => ({ staff_id, uses }))
    );

    const minha = fatias.find((f) => f.staff_id === staff.staffId);
    if (minha) total += centsToBRL(minha.amountCents);
  }

  return total;
}

// ------------------------------------------------------------------
// Resumo do dia
// ------------------------------------------------------------------

export interface ResumoDoDia {
  clientesHoje: number;
  concluidosHoje: number;
  proximo: AgendamentoPainel | null;
  produzidoHoje: number;
  comissaoHoje: number;
}

export async function resumoDoDia(staff: SessionStaff): Promise<ResumoDoDia> {
  const hoje = hojeStr();
  const [agenda, financeiro] = await Promise.all([
    agendaDoDia(staff, hoje),
    financeiroDoPeriodo(staff, hoje, hoje),
  ]);

  const agora = new Date();
  const proximo =
    agenda.find(
      (a) =>
        new Date(a.inicio) >= agora &&
        !['cancelled', 'completed', 'no_show'].includes(a.status)
    ) ?? null;

  return {
    clientesHoje: agenda.filter((a) => a.status !== 'cancelled').length,
    concluidosHoje: agenda.filter((a) => a.status === 'completed').length,
    proximo,
    produzidoHoje: financeiro.producaoTotal,
    comissaoHoje: financeiro.comissao,
  };
}

// ------------------------------------------------------------------
// Vales
// ------------------------------------------------------------------

export interface ValePainel {
  id: string;
  valor: number;
  motivo: string | null;
  status: string;
  pedidoEm: string;
  respondidoEm: string | null;
  observacaoDaGestao: string | null;
}

export async function valesDoStaff(staff: SessionStaff): Promise<ValePainel[]> {
  const admin = createAdminClient();

  const { data } = await admin
    .from('allowances')
    .select('id, amount, reason, status, requested_at, reviewed_at, review_notes')
    .eq('barbershop_id', BARBERSHOP_ID)
    .eq('staff_id', staff.staffId)
    .order('requested_at', { ascending: false })
    .limit(100);

  return (data ?? []).map((v) => ({
    id: v.id as string,
    valor: Number(v.amount ?? 0),
    motivo: (v.reason as string) ?? null,
    status: v.status as string,
    pedidoEm: v.requested_at as string,
    respondidoEm: (v.reviewed_at as string) ?? null,
    observacaoDaGestao: (v.review_notes as string) ?? null,
  }));
}

// ------------------------------------------------------------------
// Clientes
// ------------------------------------------------------------------

export interface ClientePainel {
  id: string;
  nome: string;
  telefone: string | null;
  ultimaVisita: string | null;
  atendimentos: number;
  servicosHabituais: string[];
  observacoes: string | null;
  alergias: string | null;
  assinatura: AssinaturaResumo | null;
}

/**
 * Clientes que ele atendeu de verdade.
 *
 * Fonte canonica: item de comanda fechada executado por ele. Agendamento
 * futuro nao entra, e comanda aberta tambem nao, senao a lista viraria a base
 * inteira de clientes da barbearia com outro nome.
 */
export async function clientesDoStaff(staff: SessionStaff): Promise<ClientePainel[]> {
  const admin = createAdminClient();

  const { data: itens } = await admin
    .from('comanda_items')
    .select('name, item_type, created_at, comanda:comandas!inner ( customer_id, status, closed_at )')
    .eq('barbershop_id', BARBERSHOP_ID)
    .eq('staff_id', staff.staffId)
    .eq('comanda.status', 'closed')
    .order('created_at', { ascending: false })
    .limit(1000);

  const porCliente = new Map<
    string,
    { atendimentos: number; ultima: string | null; servicos: Map<string, number> }
  >();

  for (const item of itens ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const comanda = item.comanda as any;
    const customerId = comanda?.customer_id as string | undefined;
    if (!customerId) continue;

    const atual =
      porCliente.get(customerId) ?? { atendimentos: 0, ultima: null, servicos: new Map() };

    if (item.item_type === 'service') {
      atual.atendimentos += 1;
      const nome = item.name as string;
      if (nome) atual.servicos.set(nome, (atual.servicos.get(nome) ?? 0) + 1);
    }

    const fechada = comanda?.closed_at as string | undefined;
    if (fechada && (!atual.ultima || fechada > atual.ultima)) atual.ultima = fechada;

    porCliente.set(customerId, atual);
  }

  const ids = [...porCliente.keys()];
  if (ids.length === 0) return [];

  const [{ data: clientes }, assinaturas] = await Promise.all([
    admin
      .from('customers')
      .select('id, full_name, phone, notes, allergies')
      .in('id', ids),
    assinaturasPorCliente(ids),
  ]);

  return (clientes ?? [])
    .map((c) => {
      const agregado = porCliente.get(c.id as string)!;
      const habituais = [...agregado.servicos.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([nome]) => nome);

      return {
        id: c.id as string,
        nome: c.full_name as string,
        telefone: (c.phone as string) ?? null,
        ultimaVisita: agregado.ultima,
        atendimentos: agregado.atendimentos,
        servicosHabituais: habituais,
        observacoes: (c.notes as string) ?? null,
        alergias: (c.allergies as string) ?? null,
        assinatura: assinaturas.get(c.id as string) ?? null,
      };
    })
    .sort((a, b) => (b.ultimaVisita ?? '').localeCompare(a.ultimaVisita ?? ''));
}
