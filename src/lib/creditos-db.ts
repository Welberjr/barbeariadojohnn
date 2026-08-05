/**
 * Credito do cliente: leitura e escrita no banco.
 *
 * As regras de quanto vale, o que venceu e de onde tirar o dinheiro estao em
 * credito-cliente.ts, que nao conhece banco nenhum e por isso e testavel. Aqui
 * so buscamos as linhas e gravamos o resultado.
 */
import { createAdminClient } from '@/lib/supabase/admin';
import { comoGastar, saldoDisponivel, type Credito } from '@/lib/credito-cliente';
import { lojaAtual } from '@/lib/loja';

/**
 * Todos os creditos de um cliente, com o quanto ja foi gasto de cada um.
 *
 * O usado sai da soma das linhas de uso, nunca de um campo guardado: assim o
 * saldo nao tem como ficar diferente do historico.
 */
export async function creditosDoCliente(customerId: string): Promise<Credito[]> {
  const admin = createAdminClient();
  const barbershopId = await lojaAtual();

  const [{ data: concedidos }, { data: usos }] = await Promise.all([
    admin
      .from('customer_credits')
      .select('id, amount, reason, starts_at, expires_at, cancelled_at, created_at')
      .eq('customer_id', customerId)
      .eq('barbershop_id', barbershopId)
      .order('created_at', { ascending: false }),
    admin
      .from('customer_credit_uses')
      .select('credit_id, amount')
      .eq('customer_id', customerId)
      .eq('barbershop_id', barbershopId),
  ]);

  const gastoPorCredito = new Map<string, number>();
  for (const uso of usos ?? []) {
    const atual = gastoPorCredito.get(uso.credit_id as string) ?? 0;
    gastoPorCredito.set(uso.credit_id as string, atual + Number(uso.amount ?? 0));
  }

  return (concedidos ?? []).map((c) => ({
    id: c.id as string,
    amount: Number(c.amount),
    reason: (c.reason as string) ?? null,
    startsAt: c.starts_at as string,
    expiresAt: (c.expires_at as string) ?? null,
    cancelledAt: (c.cancelled_at as string) ?? null,
    usado: gastoPorCredito.get(c.id as string) ?? 0,
  }));
}

/** Quanto o cliente pode gastar agora. Usado para decidir se a forma de pagamento aparece. */
export async function saldoDeCredito(customerId: string): Promise<number> {
  return saldoDisponivel(await creditosDoCliente(customerId));
}

/** Saldo de varios clientes de uma vez, para listas (agenda, comandas). */
export async function saldosDeCredito(
  customerIds: string[]
): Promise<Map<string, number>> {
  const saldos = new Map<string, number>();
  if (customerIds.length === 0) return saldos;

  const admin = createAdminClient();
  const barbershopId = await lojaAtual();
  const [{ data: concedidos }, { data: usos }] = await Promise.all([
    admin
      .from('customer_credits')
      .select('id, customer_id, amount, starts_at, expires_at, cancelled_at')
      .in('customer_id', customerIds)
      .eq('barbershop_id', barbershopId),
    admin
      .from('customer_credit_uses')
      .select('credit_id, customer_id, amount')
      .in('customer_id', customerIds)
      .eq('barbershop_id', barbershopId),
  ]);

  const gastoPorCredito = new Map<string, number>();
  for (const uso of usos ?? []) {
    const atual = gastoPorCredito.get(uso.credit_id as string) ?? 0;
    gastoPorCredito.set(uso.credit_id as string, atual + Number(uso.amount ?? 0));
  }

  const porCliente = new Map<string, Credito[]>();
  for (const c of concedidos ?? []) {
    const lista = porCliente.get(c.customer_id as string) ?? [];
    lista.push({
      id: c.id as string,
      amount: Number(c.amount),
      startsAt: c.starts_at as string,
      expiresAt: (c.expires_at as string) ?? null,
      cancelledAt: (c.cancelled_at as string) ?? null,
      usado: gastoPorCredito.get(c.id as string) ?? 0,
    });
    porCliente.set(c.customer_id as string, lista);
  }

  for (const [clienteId, lista] of porCliente) {
    saldos.set(clienteId, saldoDisponivel(lista));
  }
  return saldos;
}

/**
 * Gasta credito para pagar uma comanda.
 *
 * Devolve erro em vez de gastar pela metade: se o saldo nao cobre o valor
 * inteiro, nada e gravado e quem chamou decide o que fazer.
 */
export async function gastarCredito(opts: {
  customerId: string;
  comandaId: string;
  valor: number;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = createAdminClient();
  const creditos = await creditosDoCliente(opts.customerId);
  const plano = comoGastar(creditos, opts.valor);

  if (plano.length === 0) {
    const disponivel = saldoDisponivel(creditos);
    return {
      ok: false,
      error: `Crédito insuficiente: o cliente tem R$ ${disponivel.toFixed(2).replace('.', ',')} e a comanda é de R$ ${opts.valor.toFixed(2).replace('.', ',')}.`,
    };
  }

  const loja = await lojaAtual();
  const { error } = await admin.from('customer_credit_uses').insert(
    plano.map((p) => ({
      barbershop_id: loja,
      credit_id: p.creditoId,
      customer_id: opts.customerId,
      comanda_id: opts.comandaId,
      amount: p.valor,
    }))
  );

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/*
 * Devolver credito nao mora aqui: reabrir e estornar passam pela funcao
 * desfazer_efeitos_do_fechamento no banco, que apaga os usos junto com o resto
 * do fechamento. Assim nao existe caminho que desfaz metade.
 */

/**
 * Quanto foi pago com credito num periodo.
 *
 * O financeiro usa isto para tirar esse valor da receita: credito gasto nao e
 * dinheiro que entrou no caixa hoje, e sim uma divida antiga sendo quitada.
 */
export async function creditoPorComanda(
  comandaIds: string[]
): Promise<Map<string, number>> {
  const porComanda = new Map<string, number>();
  if (comandaIds.length === 0) return porComanda;

  const admin = createAdminClient();
  const barbershopId = await lojaAtual();
  const { data } = await admin
    .from('customer_credit_uses')
    .select('comanda_id, amount')
    .in('comanda_id', comandaIds)
    .eq('barbershop_id', barbershopId);

  for (const uso of data ?? []) {
    const id = uso.comanda_id as string;
    if (!id) continue;
    porComanda.set(id, (porComanda.get(id) ?? 0) + Number(uso.amount ?? 0));
  }
  return porComanda;
}

/** O mesmo total, quando quem chama nao precisa saber de qual comanda veio. */
export async function creditoUsadoNasComandas(comandaIds: string[]): Promise<number> {
  const porComanda = await creditoPorComanda(comandaIds);
  let soma = 0;
  for (const v of porComanda.values()) soma += v;
  return soma;
}
