import { describe, it, expect } from 'vitest';
import { nomeEmDuasLinhas } from './marca-nome';

/**
 * A logo mostra o nome em duas linhas: a primeira menor, a ultima em destaque.
 * Isso nasceu da marca do Johnn e passa a valer para qualquer barbearia.
 */
describe('nome em duas linhas', () => {
  it('mantem a marca do Johnn exatamente como era', () => {
    expect(nomeEmDuasLinhas('Barbearia do Johnn')).toEqual({
      cima: 'Barbearia do',
      baixo: 'Johnn',
    });
  });

  it('nome de uma palavra so nao deixa linha vazia em cima', () => {
    expect(nomeEmDuasLinhas('Barbearia')).toEqual({ cima: null, baixo: 'Barbearia' });
  });

  it('nome comprido joga tudo menos a ultima palavra para cima', () => {
    expect(nomeEmDuasLinhas('Barbearia Corte e Estilo Premium')).toEqual({
      cima: 'Barbearia Corte e Estilo',
      baixo: 'Premium',
    });
  });

  it('espaco sobrando no cadastro nao vira linha torta', () => {
    expect(nomeEmDuasLinhas('  Barbearia   do   Johnn  ')).toEqual({
      cima: 'Barbearia do',
      baixo: 'Johnn',
    });
  });

  it('nome vazio nao quebra a tela', () => {
    const r = nomeEmDuasLinhas('');
    expect(r.baixo).toBe('');
    expect(r.cima).toBeNull();
  });
});

/**
 * O nome grande precisa caber nos 400 do desenho. A conta e a mesma da logo:
 * encolhe so quando precisa, entao quem ja tinha continua identico.
 */
function tamanhoDoNome(baixo: string): number {
  return Math.min(118, Math.round(590 / Math.max(1, baixo.length)));
}

describe('tamanho da letra no desenho', () => {
  it('JOHNN continua nos 118 de sempre', () => {
    expect(tamanhoDoNome('Johnn')).toBe(118);
  });

  it('nome curto nao estica alem do original', () => {
    expect(tamanhoDoNome('Rei')).toBe(118);
  });

  it('nome comprido encolhe para nao sair pela borda', () => {
    const t = tamanhoDoNome('Empreendimentos');
    expect(t).toBeLessThan(118);
    // 15 letras no tamanho devolvido tem que caber nos 400 do desenho
    expect(t * 15 * 0.6).toBeLessThan(400);
  });

  it('nunca devolve tamanho zero ou negativo', () => {
    expect(tamanhoDoNome('')).toBeGreaterThan(0);
  });
});
