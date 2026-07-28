import { describe, it, expect } from 'vitest';
import { montarSelo, type AssinaturaResumo } from './assinatura-selo';

// Quarta-feira, 29/07/2026, 10h no fuso da barbearia
const QUARTA = new Date('2026-07-29T13:00:00.000Z');
// Domingo, 02/08/2026
const DOMINGO = new Date('2026-08-02T13:00:00.000Z');

function assinatura(over: Partial<AssinaturaResumo> = {}): AssinaturaResumo {
  return {
    planoNome: 'Clube Ouro',
    usosIncluidos: 4,
    usosNoCiclo: 2,
    usosRestantes: 2,
    fimDoCiclo: '2026-08-15T00:00:00.000Z',
    diasPermitidos: null,
    vencida: false,
    ...over,
  };
}

describe('montarSelo', () => {
  it('não mostra nada para quem não é assinante', () => {
    const selo = montarSelo(null, QUARTA);
    expect(selo.situacao).toBe('sem_assinatura');
    expect(selo.texto).toBe('');
    expect(selo.cobre).toBe(false);
  });

  it('mostra o saldo restante quando pode cobrir', () => {
    const selo = montarSelo(assinatura(), QUARTA);
    expect(selo.situacao).toBe('com_saldo');
    expect(selo.texto).toBe('Clube Ouro · restam 2 de 4');
    expect(selo.cobre).toBe(true);
  });

  it('avisa para cobrar avulso quando os usos acabaram', () => {
    const selo = montarSelo(assinatura({ usosRestantes: 0, usosNoCiclo: 4 }), QUARTA);
    expect(selo.situacao).toBe('sem_saldo');
    expect(selo.texto).toContain('usos esgotados');
    expect(selo.cobre).toBe(false);
  });

  it('avisa quando o ciclo venceu e ainda não foi pago', () => {
    const selo = montarSelo(assinatura({ vencida: true }), QUARTA);
    expect(selo.situacao).toBe('vencida');
    expect(selo.texto).toContain('aguardando pagamento');
    expect(selo.cobre).toBe(false);
  });

  it('avisa quando hoje está fora dos dias do plano', () => {
    // Plano vale de quarta (3) a sexta (5); o atendimento é domingo
    const selo = montarSelo(assinatura({ diasPermitidos: [3, 4, 5] }), DOMINGO);
    expect(selo.situacao).toBe('fora_do_dia');
    expect(selo.texto).toContain('hoje cobra avulso');
    expect(selo.cobre).toBe(false);
  });

  it('cobre normalmente quando o dia está dentro do plano', () => {
    const selo = montarSelo(assinatura({ diasPermitidos: [3, 4, 5] }), QUARTA);
    expect(selo.situacao).toBe('com_saldo');
    expect(selo.cobre).toBe(true);
  });

  it('ciclo vencido tem prioridade sobre dia não permitido', () => {
    const selo = montarSelo(
      assinatura({ vencida: true, diasPermitidos: [3, 4, 5] }),
      DOMINGO
    );
    expect(selo.situacao).toBe('vencida');
  });

  it('falta de saldo tem prioridade sobre dia não permitido', () => {
    const selo = montarSelo(
      assinatura({ usosRestantes: 0, diasPermitidos: [3, 4, 5] }),
      DOMINGO
    );
    expect(selo.situacao).toBe('sem_saldo');
  });
});
