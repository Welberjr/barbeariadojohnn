import { describe, it, expect } from 'vitest';
import { avaliarAcao, acoesDisponiveis } from './agenda-estados';

const INICIO = new Date('2026-07-29T13:00:00.000Z'); // 10h em Brasília
const ANTES = new Date('2026-07-29T12:30:00.000Z');
const DEPOIS = new Date('2026-07-29T13:30:00.000Z');

describe('avaliarAcao', () => {
  it('confirma um agendamento marcado', () => {
    const r = avaliarAcao('scheduled', 'confirmar', INICIO, ANTES);
    expect(r.ok).toBe(true);
    expect(r.proximo).toBe('confirmed');
  });

  it('não confirma duas vezes', () => {
    const r = avaliarAcao('confirmed', 'confirmar', INICIO, ANTES);
    expect(r.ok).toBe(false);
    expect(r.motivo).toContain('confirmado');
  });

  it('conclui direto de agendado, sem exigir confirmação', () => {
    // No balcão o cliente às vezes senta na cadeira sem ninguém confirmar nada
    expect(avaliarAcao('scheduled', 'concluir', INICIO, DEPOIS).ok).toBe(true);
  });

  it('não deixa marcar falta antes da hora marcada', () => {
    const r = avaliarAcao('confirmed', 'falta', INICIO, ANTES);
    expect(r.ok).toBe(false);
    expect(r.motivo).toContain('Ainda não deu o horário');
  });

  it('deixa marcar falta depois da hora', () => {
    expect(avaliarAcao('confirmed', 'falta', INICIO, DEPOIS).ok).toBe(true);
  });

  it('não mexe em atendimento concluído', () => {
    for (const acao of ['confirmar', 'iniciar', 'concluir', 'falta'] as const) {
      expect(avaliarAcao('completed', acao, INICIO, DEPOIS).ok).toBe(false);
    }
  });

  it('não mexe em atendimento cancelado nem em falta', () => {
    expect(avaliarAcao('cancelled', 'concluir', INICIO, DEPOIS).ok).toBe(false);
    expect(avaliarAcao('no_show', 'concluir', INICIO, DEPOIS).ok).toBe(false);
  });

  it('não volta de em atendimento para confirmado', () => {
    expect(avaliarAcao('in_progress', 'confirmar', INICIO, DEPOIS).ok).toBe(false);
  });
});

describe('acoesDisponiveis', () => {
  it('antes da hora, mostra confirmar, iniciar e concluir, sem falta', () => {
    expect(acoesDisponiveis('scheduled', INICIO, ANTES)).toEqual([
      'confirmar',
      'iniciar',
      'concluir',
    ]);
  });

  it('depois da hora, libera a falta', () => {
    expect(acoesDisponiveis('scheduled', INICIO, DEPOIS)).toContain('falta');
  });

  it('em atendimento, só resta concluir', () => {
    expect(acoesDisponiveis('in_progress', INICIO, DEPOIS)).toEqual(['concluir']);
  });

  it('estado final não oferece nada', () => {
    expect(acoesDisponiveis('completed', INICIO, DEPOIS)).toEqual([]);
    expect(acoesDisponiveis('no_show', INICIO, DEPOIS)).toEqual([]);
  });
});
