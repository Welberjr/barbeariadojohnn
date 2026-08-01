import { describe, it, expect } from 'vitest';
import {
  saldoDoCredito,
  situacaoDoCredito,
  saldoDisponivel,
  comoGastar,
  quantoOCreditoCobre,
  diasParaVencer,
  avisoDeVencimento,
  type Credito,
} from './credito-cliente';

function credito(over: Partial<Credito> = {}): Credito {
  return {
    id: 'c1',
    amount: 1000,
    startsAt: '2026-08-02',
    expiresAt: '2027-08-02',
    cancelledAt: null,
    usado: 0,
    ...over,
  };
}

describe('saldo', () => {
  it('desconta o que ja foi usado', () => {
    expect(saldoDoCredito(credito({ usado: 350 }))).toBe(650);
  });

  it('nunca fica negativo', () => {
    expect(saldoDoCredito(credito({ amount: 100, usado: 150 }))).toBe(0);
  });
});

describe('situacao', () => {
  it('vale dentro do prazo', () => {
    expect(situacaoDoCredito(credito(), '2026-12-25')).toBe('disponivel');
  });

  it('no primeiro dia ja vale', () => {
    expect(situacaoDoCredito(credito(), '2026-08-02')).toBe('disponivel');
  });

  it('no ultimo dia ainda vale', () => {
    expect(situacaoDoCredito(credito(), '2027-08-02')).toBe('disponivel');
  });

  it('no dia seguinte ao prazo ja venceu', () => {
    expect(situacaoDoCredito(credito(), '2027-08-03')).toBe('vencido');
  });

  it('antes de comecar nao pode usar', () => {
    expect(situacaoDoCredito(credito(), '2026-08-01')).toBe('ainda_nao_comecou');
  });

  it('cancelado vence tudo', () => {
    const c = credito({ cancelledAt: '2026-09-01T10:00:00Z' });
    expect(situacaoDoCredito(c, '2026-12-25')).toBe('cancelado');
  });

  it('esgotado quando gastou tudo', () => {
    expect(situacaoDoCredito(credito({ usado: 1000 }), '2026-12-25')).toBe('esgotado');
  });

  it('credito sem prazo nunca vence', () => {
    const c = credito({ expiresAt: null });
    expect(situacaoDoCredito(c, '2099-01-01')).toBe('disponivel');
  });
});

describe('saldo disponivel', () => {
  it('soma so o que vale hoje', () => {
    const creditos = [
      credito({ id: 'a', amount: 1000, usado: 200 }),
      credito({ id: 'b', amount: 500, expiresAt: '2026-07-01' }), // vencido
      credito({ id: 'c', amount: 300, startsAt: '2027-01-01' }), // ainda nao comecou
    ];
    expect(saldoDisponivel(creditos, '2026-12-25')).toBe(800);
  });

  it('sem credito nenhum e zero', () => {
    expect(saldoDisponivel([], '2026-12-25')).toBe(0);
  });
});

describe('como gastar', () => {
  it('tira de um credito so quando cabe', () => {
    const plano = comoGastar([credito()], 60, '2026-12-25');
    expect(plano).toEqual([{ creditoId: 'c1', valor: 60 }]);
  });

  it('gasta primeiro o que vence antes', () => {
    const creditos = [
      credito({ id: 'longe', amount: 100, expiresAt: '2027-12-31' }),
      credito({ id: 'perto', amount: 100, expiresAt: '2026-12-31' }),
    ];
    const plano = comoGastar(creditos, 150, '2026-12-01');
    expect(plano).toEqual([
      { creditoId: 'perto', valor: 100 },
      { creditoId: 'longe', valor: 50 },
    ]);
  });

  it('deixa o credito sem prazo por ultimo', () => {
    const creditos = [
      credito({ id: 'sem-prazo', amount: 100, expiresAt: null }),
      credito({ id: 'com-prazo', amount: 100, expiresAt: '2027-01-01' }),
    ];
    const plano = comoGastar(creditos, 50, '2026-12-01');
    expect(plano).toEqual([{ creditoId: 'com-prazo', valor: 50 }]);
  });

  it('nao usa credito vencido nem para completar', () => {
    const creditos = [
      credito({ id: 'vale', amount: 40 }),
      credito({ id: 'venceu', amount: 500, expiresAt: '2026-01-01' }),
    ];
    expect(comoGastar(creditos, 100, '2026-12-25')).toEqual([]);
  });

  it('ou cobre o valor inteiro ou nao usa nada', () => {
    expect(comoGastar([credito({ amount: 30 })], 100, '2026-12-25')).toEqual([]);
  });

  it('valor zerado nao mexe em nada', () => {
    expect(comoGastar([credito()], 0, '2026-12-25')).toEqual([]);
  });

  it('fecha certinho com centavos', () => {
    const creditos = [
      credito({ id: 'a', amount: 10.5, expiresAt: '2026-12-30' }),
      credito({ id: 'b', amount: 20, expiresAt: '2027-01-30' }),
    ];
    const plano = comoGastar(creditos, 30.5, '2026-12-01');
    expect(plano).toEqual([
      { creditoId: 'a', valor: 10.5 },
      { creditoId: 'b', valor: 20 },
    ]);
  });
});

describe('o que o credito cobre', () => {
  it('paga o servico inteiro quando so tem servico', () => {
    const cobre = quantoOCreditoCobre({
      valorServicos: 60,
      subtotal: 60,
      desconto: 0,
      saldo: 1000,
    });
    expect(cobre).toBe(60);
  });

  it('nao paga produto: a pomada fica de fora', () => {
    const cobre = quantoOCreditoCobre({
      valorServicos: 60,
      subtotal: 105, // 60 de corte + 45 de pomada
      desconto: 0,
      saldo: 1000,
    });
    expect(cobre).toBe(60);
  });

  it('comanda so de produto nao usa credito nenhum', () => {
    const cobre = quantoOCreditoCobre({
      valorServicos: 0,
      subtotal: 45,
      desconto: 0,
      saldo: 1000,
    });
    expect(cobre).toBe(0);
  });

  it('divide o desconto entre servico e produto', () => {
    // 60 de servico + 40 de produto, 10 de desconto: 6 saem do servico
    const cobre = quantoOCreditoCobre({
      valorServicos: 60,
      subtotal: 100,
      desconto: 10,
      saldo: 1000,
    });
    expect(cobre).toBe(54);
  });

  it('nunca passa do saldo que sobrou', () => {
    const cobre = quantoOCreditoCobre({
      valorServicos: 60,
      subtotal: 60,
      desconto: 0,
      saldo: 25,
    });
    expect(cobre).toBe(25);
  });

  it('sem saldo nao cobre nada', () => {
    const cobre = quantoOCreditoCobre({
      valorServicos: 60,
      subtotal: 60,
      desconto: 0,
      saldo: 0,
    });
    expect(cobre).toBe(0);
  });
});

describe('prazo', () => {
  it('conta os dias que faltam', () => {
    expect(diasParaVencer(credito({ expiresAt: '2026-08-10' }), '2026-08-01')).toBe(9);
  });

  it('credito sem prazo nao tem contagem', () => {
    expect(diasParaVencer(credito({ expiresAt: null }), '2026-08-01')).toBeNull();
  });

  it('avisa quando esta perto', () => {
    const emUso = { startsAt: '2026-01-01' };
    expect(
      avisoDeVencimento(credito({ ...emUso, expiresAt: '2026-08-10' }), '2026-08-01')
    ).toBe('vence em 9 dias');
    expect(
      avisoDeVencimento(credito({ ...emUso, expiresAt: '2026-08-02' }), '2026-08-01')
    ).toBe('vence amanhã');
    expect(
      avisoDeVencimento(credito({ ...emUso, expiresAt: '2026-08-01' }), '2026-08-01')
    ).toBe('vence hoje');
  });

  it('nao enche o saco quando falta muito', () => {
    const c = credito({ startsAt: '2026-01-01', expiresAt: '2027-08-02' });
    expect(avisoDeVencimento(c, '2026-08-01')).toBeNull();
  });

  it('nao avisa sobre credito que nao da para usar', () => {
    const c = credito({ expiresAt: '2026-08-05', cancelledAt: '2026-07-01T00:00:00Z' });
    expect(avisoDeVencimento(c, '2026-08-01')).toBeNull();
  });
});
