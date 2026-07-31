import { describe, it, expect } from 'vitest';
import {
  devePedirConfirmacao,
  podeConfirmar,
  situacao,
  textoDoPedido,
  type DadosConfirmacao,
} from './confirmacao-agendamento';

const AGORA = new Date('2026-08-03T10:00:00-03:00');

function dados(over: Partial<DadosConfirmacao> = {}): DadosConfirmacao {
  return {
    status: 'scheduled',
    inicio: new Date('2026-08-04T09:00:00-03:00'), // 23 horas depois
    pedidaEm: null,
    confirmadaEm: null,
    ...over,
  };
}

describe('devePedirConfirmacao', () => {
  it('pede quando o horário está dentro da janela', () => {
    expect(devePedirConfirmacao(dados(), AGORA)).toBe(true);
  });

  it('não pede duas vezes para o mesmo cliente', () => {
    expect(devePedirConfirmacao(dados({ pedidaEm: AGORA }), AGORA)).toBe(false);
  });

  it('não pede para quem já confirmou', () => {
    expect(devePedirConfirmacao(dados({ confirmadaEm: AGORA }), AGORA)).toBe(false);
  });

  it('não pede para horário ainda distante', () => {
    const daquiTresDias = new Date('2026-08-06T09:00:00-03:00');
    expect(devePedirConfirmacao(dados({ inicio: daquiTresDias }), AGORA)).toBe(false);
  });

  it('não pede para horário que já passou', () => {
    const ontem = new Date('2026-08-02T09:00:00-03:00');
    expect(devePedirConfirmacao(dados({ inicio: ontem }), AGORA)).toBe(false);
  });

  it('não pede para atendimento cancelado ou concluído', () => {
    expect(devePedirConfirmacao(dados({ status: 'cancelled' }), AGORA)).toBe(false);
    expect(devePedirConfirmacao(dados({ status: 'completed' }), AGORA)).toBe(false);
  });

  it('respeita a janela configurada pela barbearia', () => {
    // 23 horas de antecedência não entra numa janela de 12 horas
    expect(devePedirConfirmacao(dados(), AGORA, 12)).toBe(false);
    expect(devePedirConfirmacao(dados(), AGORA, 48)).toBe(true);
  });
});

describe('podeConfirmar', () => {
  it('dá para confirmar até a hora do atendimento', () => {
    expect(podeConfirmar(dados(), AGORA)).toBe(true);
  });

  it('não dá para confirmar duas vezes', () => {
    expect(podeConfirmar(dados({ confirmadaEm: AGORA }), AGORA)).toBe(false);
  });

  it('não dá para confirmar depois da hora', () => {
    const ontem = new Date('2026-08-02T09:00:00-03:00');
    expect(podeConfirmar(dados({ inicio: ontem }), AGORA)).toBe(false);
  });

  it('não dá para confirmar atendimento cancelado', () => {
    expect(podeConfirmar(dados({ status: 'cancelled' }), AGORA)).toBe(false);
  });
});

describe('situacao', () => {
  it('sem pedido é "não pedida"', () => {
    expect(situacao(dados(), AGORA)).toBe('nao_pedida');
  });

  it('pedido feito e horário longe é "aguardando"', () => {
    expect(situacao(dados({ pedidaEm: AGORA }), AGORA)).toBe('aguardando');
  });

  it('pedido feito e horário perto vira "sem resposta"', () => {
    const daquiTresHoras = new Date('2026-08-03T13:00:00-03:00');
    expect(situacao(dados({ inicio: daquiTresHoras, pedidaEm: AGORA }), AGORA)).toBe(
      'sem_resposta'
    );
  });

  it('confirmada é confirmada, mesmo em cima da hora', () => {
    const daquiUmaHora = new Date('2026-08-03T11:00:00-03:00');
    expect(
      situacao(dados({ inicio: daquiUmaHora, pedidaEm: AGORA, confirmadaEm: AGORA }), AGORA)
    ).toBe('confirmada');
  });
});

describe('textoDoPedido', () => {
  it('fala com o cliente pelo primeiro nome e diz o dia', () => {
    const t = textoDoPedido({
      primeiroNome: 'João',
      servico: 'Corte',
      inicio: new Date('2026-08-04T09:00:00-03:00'),
      profissional: 'Kevin',
    });
    expect(t.corpo).toContain('João');
    expect(t.corpo).toContain('Corte');
    expect(t.corpo).toContain('Kevin');
    expect(t.corpo).toContain('terça-feira');
  });

  it('sem profissional definido, não inventa nome', () => {
    const t = textoDoPedido({
      primeiroNome: 'Ana',
      servico: 'Barba',
      inicio: new Date('2026-08-04T09:00:00-03:00'),
      profissional: null,
    });
    expect(t.corpo).not.toContain('com ');
  });
});
