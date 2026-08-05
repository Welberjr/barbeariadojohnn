import { describe, it, expect } from 'vitest';
import {
  normalizarTelefone,
  variantesDoTelefone,
  mesmoTelefone,
  formatarTelefoneExibicao,
} from './telefone';

describe('formatarTelefoneExibicao', () => {
  it('celular do sistema antigo aparece com o nono dígito', () => {
    // Gravado sem o 9 e com o 55, como 408 dos 414 clientes da base
    expect(formatarTelefoneExibicao('556191723963')).toBe('(61) 99172-3963');
  });

  it('celular completo aparece com máscara de onze dígitos', () => {
    expect(formatarTelefoneExibicao('61993070607')).toBe('(61) 99307-0607');
  });

  it('fixo continua com máscara de dez dígitos', () => {
    expect(formatarTelefoneExibicao('6133334444')).toBe('(61) 3333-4444');
  });

  it('número que não dá para entender volta como veio', () => {
    expect(formatarTelefoneExibicao('123')).toBe('123');
    expect(formatarTelefoneExibicao(null)).toBe('');
  });
});

describe('normalizarTelefone', () => {
  it('celular antigo de oito casas ganha o nono dígito', () => {
    // É como estão 399 dos 415 clientes da barbearia
    expect(normalizarTelefone('6193070607')).toBe('61993070607');
  });

  it('celular que já tem nove casas fica como está', () => {
    expect(normalizarTelefone('61993070607')).toBe('61993070607');
  });

  it('tira o código do país', () => {
    expect(normalizarTelefone('556193070607')).toBe('61993070607');
    expect(normalizarTelefone('5561993070607')).toBe('61993070607');
  });

  it('aceita o número escrito com máscara', () => {
    expect(normalizarTelefone('(61) 99307-0607')).toBe('61993070607');
    expect(normalizarTelefone('+55 61 9307-0607')).toBe('61993070607');
  });

  it('fixo não ganha nono dígito', () => {
    expect(normalizarTelefone('6133334444')).toBe('6133334444');
    expect(normalizarTelefone('1125556666')).toBe('1125556666');
  });

  it('número que não dá para entender vira nulo', () => {
    expect(normalizarTelefone('123')).toBeNull();
    expect(normalizarTelefone('')).toBeNull();
    expect(normalizarTelefone('9999999999999999')).toBeNull();
  });
});

describe('variantesDoTelefone', () => {
  it('acha o cliente esteja gravado do jeito antigo ou do novo', () => {
    const formas = variantesDoTelefone('61993070607');

    // Como o Alef está gravado hoje, vindo do sistema antigo
    expect(formas).toContain('556193070607');
    // Como ele digitaria hoje
    expect(formas).toContain('61993070607');
    expect(formas).toContain('6193070607');
    expect(formas).toContain('5561993070607');
  });

  it('digitando do jeito antigo, acha do mesmo jeito', () => {
    const digitadoAntigo = variantesDoTelefone('6193070607');
    expect(digitadoAntigo).toContain('556193070607');
    expect(digitadoAntigo).toContain('61993070607');
  });

  it('fixo não inventa variante com nove', () => {
    const formas = variantesDoTelefone('6133334444');
    expect(formas).toEqual(expect.arrayContaining(['6133334444', '556133334444']));
    expect(formas.some((f) => f.includes('933334444'))).toBe(false);
  });

  it('número inválido não gera busca nenhuma', () => {
    expect(variantesDoTelefone('123')).toEqual([]);
  });
});

describe('mesmoTelefone', () => {
  it('reconhece o mesmo número escrito de jeitos diferentes', () => {
    // O caso que o Welber levantou: cadastro sem o 9, cliente digita com o 9
    expect(mesmoTelefone('556193070607', '61993070607')).toBe(true);
    expect(mesmoTelefone('6193070607', '(61) 99307-0607')).toBe(true);
    expect(mesmoTelefone('+5561993070607', '6193070607')).toBe(true);
  });

  it('não confunde números diferentes', () => {
    expect(mesmoTelefone('61993070607', '61993070608')).toBe(false);
    expect(mesmoTelefone('61993070607', '11993070607')).toBe(false);
  });

  it('número inválido nunca é igual a nada', () => {
    expect(mesmoTelefone('123', '123')).toBe(false);
  });
});
