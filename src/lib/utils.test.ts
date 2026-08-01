import { describe, expect, it } from 'vitest';

import { formatDate, formatPhone } from './utils';

describe('formatDate', () => {
  it('uses the barbershop timezone for server and browser rendering', () => {
    const instant = '2026-07-29T01:30:00.000Z';

    expect(formatDate(instant)).toBe('28/07/2026');
    expect(formatDate(instant, 'datetime')).toContain('28/07/2026');
    expect(formatDate(instant, 'datetime')).toContain('22:30');
  });
});

describe('formatPhone', () => {
  it('escreve o celular do jeito que se le', () => {
    expect(formatPhone('61994245349')).toBe('(61) 99424-5349');
  });

  it('escreve o fixo do jeito que se le', () => {
    expect(formatPhone('6133334444')).toBe('(61) 3333-4444');
  });

  it('tira o 55 dos numeros que vieram do sistema antigo', () => {
    // 55 + dez digitos: sobra um numero de oito casas, escrito como fixo
    expect(formatPhone('556194245349')).toBe('(61) 9424-5349');
  });

  it('numero de 13 digitos com 55 vira celular formatado', () => {
    expect(formatPhone('5561994245349')).toBe('(61) 99424-5349');
  });

  it('numero que nao da para entender fica como veio', () => {
    expect(formatPhone('123')).toBe('123');
  });
});
