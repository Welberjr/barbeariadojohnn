/**
 * Motor de assinaturas (Clube) — regras de negocio centralizadas.
 *
 * Modelo (tabelas normalizadas):
 *  - subscription_plans: preco, periodo, allowed_days, included_uses,
 *    barber_share_percent (parte do "potinho" dos barbeiros)
 *  - subscriptions: assinatura do cliente com ciclo ancorado no vencimento
 *  - subscription_usages: ledger de visitas (quem atendeu, quando, valor)
 *  - subscription_payments: log de pagamentos (dispara reset + rateio)
 *  - subscription_payouts(+items): fechamento do potinho por ciclo
 *
 * Regras combinadas com o Welber (09-10/06/2026):
 *  1. allowed_days: cliente PODE agendar fora dos dias, mas o atendimento
 *     nao conta como uso da assinatura (cobra avulso) e ele e avisado.
 *  2. Potinho = preco x barber_share_percent. Distribuido INTEIRO entre os
 *     barbeiros que atenderam no ciclo, proporcional aos atendimentos.
 *     Fecha no momento do pagamento/renovacao (mesmo momento do reset).
 *     Ciclo sem nenhuma visita: potinho fica como receita da barbearia.
 *  3. Reset de usos e INDIVIDUAL, disparado pelo lancamento do pagamento
 *     daquele cliente. Nunca global, nunca por virada de mes.
 */

export const DAY_LABELS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
export const DAY_LABELS_FULL = [
  'Domingo',
  'Segunda',
  'Terça',
  'Quarta',
  'Quinta',
  'Sexta',
  'Sábado',
];

/** Fuso da barbearia (Brasília). Vercel roda em UTC, entao normalizamos. */
export const SHOP_TZ = 'America/Sao_Paulo';

/** Dia da semana (0=Dom..6=Sáb) de uma data no fuso da barbearia. */
export function shopDayOfWeek(date: Date): number {
  const wd = new Intl.DateTimeFormat('en-US', {
    timeZone: SHOP_TZ,
    weekday: 'short',
  }).format(date);
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return map[wd] ?? date.getDay();
}

/** Data yyyy-mm-dd no fuso da barbearia. */
export function shopDateString(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: SHOP_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function isDayAllowed(date: Date, allowedDays: number[] | null | undefined): boolean {
  if (!allowedDays || allowedDays.length === 0) return true;
  return allowedDays.includes(shopDayOfWeek(date));
}

export function formatAllowedDays(allowedDays: number[] | null | undefined): string {
  if (!allowedDays || allowedDays.length === 0 || allowedDays.length === 7) {
    return 'Todos os dias';
  }
  const sorted = [...allowedDays].sort((a, b) => a - b);
  // Sequencia continua vira intervalo (ex: Seg a Qui)
  const isSequential = sorted.every(
    (d, i) => i === 0 || d === sorted[i - 1] + 1
  );
  if (isSequential && sorted.length > 2) {
    return `${DAY_LABELS_SHORT[sorted[0]]} a ${DAY_LABELS_SHORT[sorted[sorted.length - 1]]}`;
  }
  return sorted.map((d) => DAY_LABELS_SHORT[d]).join(', ');
}

/** Soma um periodo de cobranca a uma data (enum billing_period). */
export function addBillingPeriod(date: Date, period: string): Date {
  const d = new Date(date);
  switch (period) {
    case 'quarterly':
      d.setMonth(d.getMonth() + 3);
      break;
    case 'semiannual':
      d.setMonth(d.getMonth() + 6);
      break;
    case 'annual':
      d.setFullYear(d.getFullYear() + 1);
      break;
    case 'monthly':
    default:
      d.setMonth(d.getMonth() + 1);
      break;
  }
  return d;
}

/**
 * Calcula o novo ciclo no pagamento, ancorado no vencimento:
 *  - pagou em dia ou ate 7 dias depois do vencimento: novo ciclo comeca
 *    exatamente onde o anterior terminou (mantem o "todo dia 15")
 *  - pagou muito atrasado (mais de 7 dias): novo ciclo comeca hoje
 */
export function nextCycle(
  currentPeriodEnd: Date,
  period: string,
  now = new Date()
): { start: Date; end: Date } {
  const graceMs = 7 * 24 * 60 * 60 * 1000;
  const start =
    now.getTime() <= currentPeriodEnd.getTime() + graceMs
      ? new Date(currentPeriodEnd)
      : new Date(now);
  return { start, end: addBillingPeriod(start, period) };
}

export interface PoolSplitInput {
  staff_id: string;
  uses: number;
}
export interface PoolSplitItem {
  staff_id: string;
  uses: number;
  amountCents: number;
}

/**
 * Rateio do potinho: distribui poolCents INTEIRO, proporcional aos usos.
 * Arredondamento: floor por barbeiro, centavos restantes vao um a um para
 * quem teve mais usos (determinístico). Soma final == poolCents sempre.
 *
 * Exemplos (pool R$60): 1 barbeiro 1x -> 60; 2 barbeiros 1x cada -> 30/30;
 * 1 barbeiro 4x -> 60; 4 barbeiros 1x cada -> 15 cada.
 */
export function splitPool(poolCents: number, byStaff: PoolSplitInput[]): PoolSplitItem[] {
  const totalUses = byStaff.reduce((s, b) => s + b.uses, 0);
  if (totalUses <= 0 || poolCents <= 0) return [];

  const items: PoolSplitItem[] = byStaff.map((b) => ({
    staff_id: b.staff_id,
    uses: b.uses,
    amountCents: Math.floor((poolCents * b.uses) / totalUses),
  }));

  let remainder = poolCents - items.reduce((s, i) => s + i.amountCents, 0);
  const order = [...items].sort(
    (a, b) => b.uses - a.uses || a.staff_id.localeCompare(b.staff_id)
  );
  let idx = 0;
  while (remainder > 0 && order.length > 0) {
    order[idx % order.length].amountCents += 1;
    remainder -= 1;
    idx += 1;
  }
  return items;
}

export function centsToBRL(cents: number): number {
  return Math.round(cents) / 100;
}

export function toCents(value: number): number {
  return Math.round(value * 100);
}

// ---------------------------------------------------------------------------
// Tipos compartilhados entre admin e painel do cliente
// ---------------------------------------------------------------------------

export interface PlanRow {
  id: string;
  name: string;
  description: string | null;
  price: number;
  period: string;
  allowed_days: number[];
  included_uses: number;
  barber_share_percent: number;
  accumulate_unused: boolean;
  show_on_public_menu: boolean;
  active: boolean;
  display_order: number;
}

export interface ActiveSubscriptionInfo {
  id: string;
  status: string;
  current_period_start: string;
  current_period_end: string;
  next_billing_at: string;
  current_price: number;
  started_at: string;
  plan: PlanRow;
  usedInCycle: number;
  usesLeft: number;
  isExpired: boolean; // hoje > fim do ciclo (aguardando pagamento)
}

/**
 * Busca a assinatura ativa (ou vencida aguardando pagamento) de um cliente,
 * ja com a contagem de usos do ciclo corrente (usos nao acertados).
 *
 * Recebe o admin client por parametro para evitar import circular.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getActiveSubscription(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  customerId: string
): Promise<ActiveSubscriptionInfo | null> {
  const { data: sub } = await admin
    .from('subscriptions')
    .select(
      `id, status, current_period_start, current_period_end, next_billing_at,
       current_price, started_at,
       plan:subscription_plans (
         id, name, description, price, period, allowed_days, included_uses,
         barber_share_percent, accumulate_unused, show_on_public_menu, active,
         display_order
       )`
    )
    .eq('customer_id', customerId)
    .in('status', ['active', 'past_due'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!sub || !sub.plan) return null;

  const { count } = await admin
    .from('subscription_usages')
    .select('id', { count: 'exact', head: true })
    .eq('subscription_id', sub.id)
    .is('settled_payout_id', null);

  const usedInCycle = count ?? 0;
  const includedUses = Number(sub.plan.included_uses ?? 0);

  return {
    id: sub.id,
    status: sub.status,
    current_period_start: sub.current_period_start,
    current_period_end: sub.current_period_end,
    next_billing_at: sub.next_billing_at,
    current_price: Number(sub.current_price ?? sub.plan.price ?? 0),
    started_at: sub.started_at,
    plan: {
      ...sub.plan,
      price: Number(sub.plan.price),
      included_uses: includedUses,
      barber_share_percent: Number(sub.plan.barber_share_percent ?? 50),
      allowed_days: (sub.plan.allowed_days ?? []) as number[],
    },
    usedInCycle,
    usesLeft: Math.max(0, includedUses - usedInCycle),
    isExpired: new Date() > new Date(sub.current_period_end),
  };
}
