import { describe, it, expect } from 'vitest';
import { ratearPotinho, lerDestinoSobra } from './subscriptions-rateio';

// CORTE PRO: R$ 120, 50% dos barbeiros, 4 cortes.
// Parte dos barbeiros = R$ 60,00 (6000 centavos), cada corte vale R$ 15,00.
const POOL = 6000;
const USOS = 4;

const CARLOS = 'carlos';
const DIEGO = 'diego';

describe('ratearPotinho', () => {
  it('cliente usou tudo: nada sobra', () => {
    const r = ratearPotinho({
      poolCents: POOL,
      includedUses: USOS,
      byStaff: [{ staff_id: CARLOS, uses: 4 }],
      destinoSobra: 'barbearia',
    });
    expect(r.valorPorUsoCents).toBe(1500);
    expect(r.items[0].amountCents).toBe(6000);
    expect(r.sobraDaBarbeariaCents).toBe(0);
    expect(r.usosNaoUsados).toBe(0);
  });

  it('cliente foi 3 de 4 vezes: barbeiro leva 45 e sobram 15', () => {
    const r = ratearPotinho({
      poolCents: POOL,
      includedUses: USOS,
      byStaff: [{ staff_id: CARLOS, uses: 3 }],
      destinoSobra: 'barbearia',
    });
    expect(r.items[0].amountCents).toBe(4500);
    expect(r.sobraDaBarbeariaCents).toBe(1500);
    expect(r.usosNaoUsados).toBe(1);
  });

  it('dois barbeiros dividem pelo que cada um atendeu', () => {
    const r = ratearPotinho({
      poolCents: POOL,
      includedUses: USOS,
      byStaff: [
        { staff_id: CARLOS, uses: 2 },
        { staff_id: DIEGO, uses: 1 },
      ],
      destinoSobra: 'barbearia',
    });
    const carlos = r.items.find((i) => i.staff_id === CARLOS)!;
    const diego = r.items.find((i) => i.staff_id === DIEGO)!;
    expect(carlos.amountCents).toBe(3000);
    expect(diego.amountCents).toBe(1500);
    expect(r.sobraDaBarbeariaCents).toBe(1500);
  });

  it('sobra dividida igual entre quem atendeu', () => {
    const r = ratearPotinho({
      poolCents: POOL,
      includedUses: USOS,
      byStaff: [
        { staff_id: CARLOS, uses: 1 },
        { staff_id: DIEGO, uses: 1 },
      ],
      destinoSobra: 'dividir_igual',
    });
    // Base 15 para cada, sobra de 30 dividida em 15 para cada
    expect(r.items.every((i) => i.amountCents === 3000)).toBe(true);
    expect(r.sobraDaBarbeariaCents).toBe(0);
    expect(r.totalDistribuidoCents).toBe(POOL);
  });

  it('sobra inteira para quem mais atendeu', () => {
    const r = ratearPotinho({
      poolCents: POOL,
      includedUses: USOS,
      byStaff: [
        { staff_id: CARLOS, uses: 2 },
        { staff_id: DIEGO, uses: 1 },
      ],
      destinoSobra: 'maior_performance',
    });
    const carlos = r.items.find((i) => i.staff_id === CARLOS)!;
    const diego = r.items.find((i) => i.staff_id === DIEGO)!;
    expect(carlos.amountCents).toBe(3000 + 1500);
    expect(diego.amountCents).toBe(1500);
    expect(r.sobraDaBarbeariaCents).toBe(0);
  });

  it('empate no maior atendimento resolve sempre igual', () => {
    const entrada = {
      poolCents: POOL,
      includedUses: USOS,
      byStaff: [
        { staff_id: 'zeca', uses: 1 },
        { staff_id: 'ana', uses: 1 },
      ],
      destinoSobra: 'maior_performance' as const,
    };
    const a = ratearPotinho(entrada);
    const b = ratearPotinho({ ...entrada, byStaff: [...entrada.byStaff].reverse() });
    expect(a.items.find((i) => i.sobraCents > 0)!.staff_id).toBe(
      b.items.find((i) => i.sobraCents > 0)!.staff_id
    );
  });

  it('ninguém atendeu: tudo fica com a barbearia, mesmo mandando dividir', () => {
    const r = ratearPotinho({
      poolCents: POOL,
      includedUses: USOS,
      byStaff: [],
      destinoSobra: 'dividir_igual',
    });
    expect(r.items).toHaveLength(0);
    expect(r.sobraDaBarbeariaCents).toBe(POOL);
    expect(r.usosNaoUsados).toBe(4);
  });

  it('cliente atendido além do que o plano inclui não gera repasse extra', () => {
    const r = ratearPotinho({
      poolCents: POOL,
      includedUses: USOS,
      byStaff: [{ staff_id: CARLOS, uses: 6 }],
      destinoSobra: 'barbearia',
    });
    expect(r.items[0].amountCents).toBe(6000);
    expect(r.totalDistribuidoCents).toBeLessThanOrEqual(POOL);
    expect(r.sobraDaBarbeariaCents).toBe(0);
  });

  it('centavo de arredondamento não some', () => {
    // Plano de R$ 119,90 com 50%: parte dos barbeiros = 5995 centavos.
    // Cada corte vale 1498 (arredondado para baixo), sobram 3 centavos.
    const r = ratearPotinho({
      poolCents: 5995,
      includedUses: 4,
      byStaff: [{ staff_id: CARLOS, uses: 4 }],
      destinoSobra: 'barbearia',
    });
    expect(r.valorPorUsoCents).toBe(1498);
    expect(r.items[0].amountCents).toBe(5992);
    expect(r.sobraDaBarbeariaCents).toBe(3);
    expect(r.totalDistribuidoCents + r.sobraDaBarbeariaCents).toBe(5995);
  });

  it('dividir igual com resto ímpar não perde nem inventa centavo', () => {
    const r = ratearPotinho({
      poolCents: 5995,
      includedUses: 4,
      byStaff: [
        { staff_id: CARLOS, uses: 1 },
        { staff_id: DIEGO, uses: 1 },
        { staff_id: 'bruno', uses: 1 },
      ],
      destinoSobra: 'dividir_igual',
    });
    expect(r.totalDistribuidoCents + r.sobraDaBarbeariaCents).toBe(5995);
    expect(r.sobraDaBarbeariaCents).toBe(0);
  });

  it('plano sem parte para os barbeiros não distribui nada', () => {
    const r = ratearPotinho({
      poolCents: 0,
      includedUses: 4,
      byStaff: [{ staff_id: CARLOS, uses: 2 }],
      destinoSobra: 'dividir_igual',
    });
    expect(r.totalDistribuidoCents).toBe(0);
    expect(r.sobraDaBarbeariaCents).toBe(0);
  });
});

describe('lerDestinoSobra', () => {
  it('aceita os três valores conhecidos', () => {
    expect(lerDestinoSobra('barbearia')).toBe('barbearia');
    expect(lerDestinoSobra('dividir_igual')).toBe('dividir_igual');
    expect(lerDestinoSobra('maior_performance')).toBe('maior_performance');
  });

  it('qualquer coisa estranha vira o padrão seguro', () => {
    expect(lerDestinoSobra(null)).toBe('barbearia');
    expect(lerDestinoSobra('dividir')).toBe('barbearia');
    expect(lerDestinoSobra(1)).toBe('barbearia');
  });
});
