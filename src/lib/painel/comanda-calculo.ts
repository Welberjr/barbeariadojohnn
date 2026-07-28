/**
 * Calculo do fechamento da comanda.
 *
 * Mesma conta que o /admin ja fazia, extraida para um lugar so e sem acesso a
 * banco. Assim o valor que o barbeiro ve fechar no painel e exatamente o que o
 * gestor ve no admin, e a conta pode ser testada sem subir o sistema.
 */

export type MetodoPagamento = 'cash' | 'pix' | 'credit' | 'debit';

export interface EntradaFechamento {
  subtotal: number;
  metodo: MetodoPagamento;
  taxaCreditoPercent: number;
  taxaDebitoPercent: number;
  gorjeta?: number;
}

export interface ResultadoFechamento {
  total: number;
  taxaPercent: number;
  taxaValor: number;
  liquido: number;
}

/** Mapeia valores antigos da interface para o enum do banco. */
export function normalizarMetodo(metodo: string): MetodoPagamento {
  const mapa: Record<string, MetodoPagamento> = {
    credit_card: 'credit',
    debit_card: 'debit',
    dinheiro: 'cash',
    cash: 'cash',
    pix: 'pix',
    credit: 'credit',
    debit: 'debit',
  };
  return mapa[metodo] ?? 'cash';
}

export function calcularFechamento(entrada: EntradaFechamento): ResultadoFechamento {
  const subtotal = Math.max(0, Number(entrada.subtotal) || 0);
  const gorjeta = Math.max(0, Number(entrada.gorjeta) || 0);

  // O painel nao aplica desconto: o teto de desconto por profissional nao
  // existe no modelo, entao desconto continua sendo assunto do admin.
  const total = subtotal + gorjeta;

  let taxaPercent = 0;
  if (entrada.metodo === 'credit') taxaPercent = Number(entrada.taxaCreditoPercent) || 0;
  else if (entrada.metodo === 'debit') taxaPercent = Number(entrada.taxaDebitoPercent) || 0;
  if (!(taxaPercent > 0)) taxaPercent = 0;

  // Arredondamento igual ao do admin, para o centavo bater nos dois lugares
  const taxaValor = Math.round(total * taxaPercent) / 100;

  return {
    total,
    taxaPercent,
    taxaValor,
    liquido: total - taxaValor,
  };
}
