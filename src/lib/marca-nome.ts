/**
 * O nome da barbearia, sem banco e sem sessao.
 *
 * Fica separado de marca.ts de proposito: a logo aparece dentro de componentes
 * que rodam no navegador, e marca.ts le cookie e banco, coisas que so existem
 * no servidor. Juntos, o navegador tentaria carregar o servidor inteiro junto
 * com o desenho da logo, e a montagem do programa falha.
 */

export interface Marca {
  nome: string;
  /** Logo propria do cliente. Sem ela, vale o emblema desenhado. */
  logoUrl: string | null;
  /** Cor principal, no formato que o CSS entende */
  cor: string | null;
  cidade: string | null;
  telefone: string | null;
}

/** Nome que aparece antes de qualquer loja existir no banco. */
export const MARCA_PADRAO: Marca = {
  nome: 'Barbearia',
  logoUrl: null,
  cor: null,
  cidade: null,
  telefone: null,
};

/**
 * Quebra o nome em duas linhas, do jeito que a logo mostra.
 *
 * "Barbearia do Johnn" vira "Barbearia do" em cima e "JOHNN" embaixo, que e
 * como a marca dele sempre foi desenhada. Nome de uma palavra so fica inteiro
 * embaixo, sem linha vazia em cima.
 */
export function nomeEmDuasLinhas(nome: string): { cima: string | null; baixo: string } {
  const partes = nome.trim().split(/\s+/);
  if (partes.length === 1) return { cima: null, baixo: partes[0] };

  const baixo = partes[partes.length - 1];
  const cima = partes.slice(0, -1).join(' ');
  return { cima, baixo };
}
