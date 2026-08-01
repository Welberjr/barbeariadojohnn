/**
 * Credito do cliente: as regras, sem banco e sem tela.
 *
 * Credito e dinheiro que a pessoa tem para gastar aqui sem passar cartao:
 * permuta, vale-presente, cortesia, acerto de servico prestado. O primeiro caso
 * foi o do Welber, que entregou o sistema e ficou com R$ 1.000 para usar dentro
 * de um ano.
 *
 * Duas coisas que nao podem ser esquecidas em nenhum lugar do codigo:
 *
 *  - Credito vence. Aceitar credito fora do prazo e dar dinheiro que a
 *    barbearia nao devia mais.
 *  - Credito usado nao e faturamento. Quando ele corta o cabelo com o credito,
 *    nao entrou dinheiro no caixa naquele dia: o pagamento ja tinha acontecido
 *    la atras, em forma de trabalho. A comissao do barbeiro sai normal, porque
 *    ele trabalhou igual.
 */

export interface Credito {
  id: string;
  amount: number;
  /** Primeiro dia de uso, no formato AAAA-MM-DD */
  startsAt: string;
  /** Ultimo dia de uso. Nulo quando o credito nao tem prazo */
  expiresAt: string | null;
  cancelledAt: string | null;
  reason?: string | null;
  /** Quanto ja foi gasto deste credito */
  usado: number;
}

export type SituacaoCredito =
  | 'disponivel'
  | 'ainda_nao_comecou'
  | 'vencido'
  | 'esgotado'
  | 'cancelado';

/** Data de hoje no fuso da barbearia, no formato que o banco guarda. */
export function hojeNaBarbearia(agora: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(agora);
}

export function saldoDoCredito(c: Credito): number {
  return Math.max(0, Number(c.amount) - Number(c.usado));
}

export function situacaoDoCredito(c: Credito, hoje: string = hojeNaBarbearia()): SituacaoCredito {
  if (c.cancelledAt) return 'cancelado';
  if (saldoDoCredito(c) <= 0) return 'esgotado';
  if (hoje < c.startsAt) return 'ainda_nao_comecou';
  if (c.expiresAt && hoje > c.expiresAt) return 'vencido';
  return 'disponivel';
}

/** Quanto o cliente pode usar hoje, somando todos os creditos que valem. */
export function saldoDisponivel(creditos: Credito[], hoje: string = hojeNaBarbearia()): number {
  return creditos
    .filter((c) => situacaoDoCredito(c, hoje) === 'disponivel')
    .reduce((soma, c) => soma + saldoDoCredito(c), 0);
}

/**
 * Como gastar um valor entre varios creditos.
 *
 * Gasta primeiro o que vence antes: assim o cliente nao perde credito com prazo
 * enquanto sobra um sem prazo parado. Credito sem prazo fica por ultimo.
 */
export function comoGastar(
  creditos: Credito[],
  valor: number,
  hoje: string = hojeNaBarbearia()
): Array<{ creditoId: string; valor: number }> {
  if (valor <= 0) return [];

  const disponiveis = creditos
    .filter((c) => situacaoDoCredito(c, hoje) === 'disponivel')
    .sort((a, b) => {
      if (a.expiresAt && b.expiresAt) return a.expiresAt.localeCompare(b.expiresAt);
      if (a.expiresAt) return -1;
      if (b.expiresAt) return 1;
      return a.startsAt.localeCompare(b.startsAt);
    });

  const plano: Array<{ creditoId: string; valor: number }> = [];
  let falta = valor;

  for (const c of disponiveis) {
    if (falta <= 0) break;
    const tira = Math.min(saldoDoCredito(c), falta);
    if (tira > 0) {
      plano.push({ creditoId: c.id, valor: Number(tira.toFixed(2)) });
      falta = Number((falta - tira).toFixed(2));
    }
  }

  // Nao gasta pela metade: ou cobre o valor pedido, ou nao usa credito nenhum
  if (falta > 0.001) return [];

  return plano;
}

/**
 * Quanto do fechamento o credito pode pagar.
 *
 * Credito paga servico, nao mercadoria: bebida, pomada e qualquer produto o
 * cliente paga normalmente. Gorjeta tambem fica de fora, porque e do barbeiro.
 *
 * Quando houve desconto na comanda, ele e dividido entre servico e produto na
 * mesma proporcao do que cada um representa, senao o desconto de um produto
 * acabaria abatendo do credito.
 */
export function quantoOCreditoCobre(opts: {
  /** Soma dos itens de servico, antes do desconto */
  valorServicos: number;
  /** Soma de tudo na comanda, antes do desconto */
  subtotal: number;
  desconto: number;
  saldo: number;
}): number {
  const { valorServicos, subtotal, desconto, saldo } = opts;
  if (valorServicos <= 0 || saldo <= 0) return 0;

  const descontoDosServicos =
    desconto > 0 && subtotal > 0 ? (desconto * valorServicos) / subtotal : 0;

  const aPagarEmServico = Math.max(0, valorServicos - descontoDosServicos);

  return Number(Math.min(saldo, aPagarEmServico).toFixed(2));
}

/** Quantos dias faltam para vencer. Negativo quer dizer que ja venceu. */
export function diasParaVencer(c: Credito, hoje: string = hojeNaBarbearia()): number | null {
  if (!c.expiresAt) return null;
  const umDia = 86400000;
  return Math.round(
    (new Date(`${c.expiresAt}T12:00:00Z`).getTime() - new Date(`${hoje}T12:00:00Z`).getTime()) /
      umDia
  );
}

export function rotuloSituacao(s: SituacaoCredito): string {
  switch (s) {
    case 'disponivel':
      return 'Disponível';
    case 'ainda_nao_comecou':
      return 'Ainda não começou';
    case 'vencido':
      return 'Vencido';
    case 'esgotado':
      return 'Todo usado';
    case 'cancelado':
      return 'Cancelado';
  }
}

/** Aviso curto para a tela, quando o prazo esta chegando. */
export function avisoDeVencimento(c: Credito, hoje: string = hojeNaBarbearia()): string | null {
  if (situacaoDoCredito(c, hoje) !== 'disponivel') return null;

  const dias = diasParaVencer(c, hoje);
  if (dias === null) return null;

  if (dias <= 0) return 'vence hoje';
  if (dias === 1) return 'vence amanhã';
  if (dias <= 30) return `vence em ${dias} dias`;
  return null;
}
