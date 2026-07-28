import { describe, it, expect } from 'vitest';
import { calcularFechamento, normalizarMetodo } from './comanda-calculo';

const TAXAS = { taxaCreditoPercent: 3.5, taxaDebitoPercent: 1.5 };

describe('calcularFechamento', () => {
  it('dinheiro e pix não têm taxa', () => {
    const dinheiro = calcularFechamento({ subtotal: 100, metodo: 'cash', ...TAXAS });
    expect(dinheiro.total).toBe(100);
    expect(dinheiro.taxaValor).toBe(0);
    expect(dinheiro.liquido).toBe(100);

    const pix = calcularFechamento({ subtotal: 100, metodo: 'pix', ...TAXAS });
    expect(pix.taxaValor).toBe(0);
  });

  it('crédito desconta a taxa de crédito', () => {
    const r = calcularFechamento({ subtotal: 100, metodo: 'credit', ...TAXAS });
    expect(r.total).toBe(100);
    expect(r.taxaValor).toBe(3.5);
    expect(r.liquido).toBe(96.5);
  });

  it('débito desconta a taxa de débito', () => {
    const r = calcularFechamento({ subtotal: 200, metodo: 'debit', ...TAXAS });
    expect(r.taxaValor).toBe(3);
    expect(r.liquido).toBe(197);
  });

  it('gorjeta entra no total e na base da taxa', () => {
    const r = calcularFechamento({ subtotal: 100, metodo: 'credit', gorjeta: 20, ...TAXAS });
    expect(r.total).toBe(120);
    expect(r.taxaValor).toBe(4.2);
  });

  it('não aceita subtotal negativo', () => {
    const r = calcularFechamento({ subtotal: -50, metodo: 'cash', ...TAXAS });
    expect(r.total).toBe(0);
  });

  it('ignora gorjeta negativa', () => {
    const r = calcularFechamento({ subtotal: 100, metodo: 'cash', gorjeta: -30, ...TAXAS });
    expect(r.total).toBe(100);
  });

  it('taxa não configurada não vira NaN', () => {
    const r = calcularFechamento({
      subtotal: 100,
      metodo: 'credit',
      taxaCreditoPercent: NaN,
      taxaDebitoPercent: 0,
    });
    expect(r.taxaValor).toBe(0);
    expect(r.liquido).toBe(100);
  });

  it('comanda coberta pela assinatura fecha zerada', () => {
    const r = calcularFechamento({ subtotal: 0, metodo: 'cash', ...TAXAS });
    expect(r.total).toBe(0);
    expect(r.liquido).toBe(0);
  });
});

describe('normalizarMetodo', () => {
  it('traduz os nomes antigos da interface', () => {
    expect(normalizarMetodo('credit_card')).toBe('credit');
    expect(normalizarMetodo('debit_card')).toBe('debit');
  });

  it('cai em dinheiro quando não reconhece', () => {
    expect(normalizarMetodo('boleto')).toBe('cash');
  });
});
