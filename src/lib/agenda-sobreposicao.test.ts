import { describe, it, expect } from 'vitest';
import { calcularColunas, type FaixaHorario } from './agenda-sobreposicao';

const faixa = (id: string, inicio: number, fim: number): FaixaHorario => ({ id, inicio, fim });

describe('calcularColunas', () => {
  it('atendimento sozinho ocupa a faixa inteira', () => {
    const r = calcularColunas([faixa('a', 600, 640)]);
    expect(r.get('a')).toEqual({ coluna: 0, colunas: 1 });
  });

  it('dois no mesmo horário dividem ao meio', () => {
    // É o caso do print: 15:50 às 16:50 e 15:50 às 16:30
    const r = calcularColunas([faixa('andre', 950, 1010), faixa('luan', 950, 990)]);
    expect(r.get('andre')?.colunas).toBe(2);
    expect(r.get('luan')?.colunas).toBe(2);
    expect(r.get('andre')?.coluna).not.toBe(r.get('luan')?.coluna);
  });

  it('sobreposição parcial também divide', () => {
    const r = calcularColunas([faixa('a', 600, 660), faixa('b', 630, 690)]);
    expect(r.get('a')?.colunas).toBe(2);
    expect(r.get('b')?.colunas).toBe(2);
  });

  it('quem termina antes do outro começar continua inteiro', () => {
    const r = calcularColunas([faixa('a', 600, 630), faixa('b', 630, 660)]);
    expect(r.get('a')).toEqual({ coluna: 0, colunas: 1 });
    expect(r.get('b')).toEqual({ coluna: 0, colunas: 1 });
  });

  it('três ao mesmo tempo dividem em três', () => {
    const r = calcularColunas([
      faixa('a', 600, 700),
      faixa('b', 610, 650),
      faixa('c', 620, 680),
    ]);
    expect([...r.values()].every((p) => p.colunas === 3)).toBe(true);
    expect(new Set([...r.values()].map((p) => p.coluna)).size).toBe(3);
  });

  it('reaproveita a coluna livre em vez de espremer sem necessidade', () => {
    // b termina antes de c começar, então c herda a coluna de b
    const r = calcularColunas([
      faixa('a', 600, 800),
      faixa('b', 600, 650),
      faixa('c', 660, 700),
    ]);
    expect(r.get('a')?.colunas).toBe(2);
    expect(r.get('b')?.coluna).toBe(r.get('c')?.coluna);
  });

  it('grupos separados não interferem um no outro', () => {
    // manhã com encaixe, tarde tranquila
    const r = calcularColunas([
      faixa('manha1', 600, 660),
      faixa('manha2', 610, 670),
      faixa('tarde', 900, 960),
    ]);
    expect(r.get('manha1')?.colunas).toBe(2);
    expect(r.get('tarde')?.colunas).toBe(1);
  });

  it('agenda vazia não quebra', () => {
    expect(calcularColunas([]).size).toBe(0);
  });

  it('mesma faixa exata para dois clientes fica lado a lado', () => {
    const r = calcularColunas([faixa('a', 600, 660), faixa('b', 600, 660)]);
    expect(r.get('a')?.coluna).toBe(0);
    expect(r.get('b')?.coluna).toBe(1);
  });
});
