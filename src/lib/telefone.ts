/**
 * Telefone brasileiro, todas as formas do mesmo numero.
 *
 * O mesmo celular aparece escrito de quatro jeitos por aqui:
 *
 *   61 9307-0607          como o sistema antigo guardou
 *   61 99307-0607         como a pessoa digita hoje, com o nono digito
 *   5561 9307-0607        com o codigo do pais
 *   5561 99307-0607       com os dois
 *
 * E isso nao e detalhe: dos 415 clientes da barbearia, 399 estao gravados sem o
 * nono digito e 408 com o 55 na frente. Procurar pela forma exata que a pessoa
 * digitou nao acha quase ninguem, e cada cliente nao encontrado vira uma ficha
 * nova do lado da que ja existe, com o historico dele preso na antiga.
 *
 * O nono digito entrou nos celulares brasileiros em 2013. Numero antigo de
 * celular tem oito casas depois do DDD e comeca com 6, 7, 8 ou 9; o mesmo numero
 * hoje tem nove casas, com um 9 na frente. Fixo comeca com 2, 3, 4 ou 5 e nunca
 * ganhou digito, entao fica fora dessa conta.
 */

/** Deixa so os numeros. */
export function soDigitos(valor: string): string {
  return (valor ?? '').replace(/\D/g, '');
}

/**
 * A forma canonica: sem codigo do pais e com o nono digito quando for celular.
 * Serve para gravar e para comparar.
 */
export function normalizarTelefone(valor: string): string | null {
  let d = soDigitos(valor);

  // Tira o codigo do pais quando sobra um telefone brasileiro plausivel
  if (d.length > 11 && d.startsWith('55')) d = d.slice(2);
  if (d.length === 12 && d.startsWith('55')) d = d.slice(2);

  if (d.length < 10 || d.length > 11) return null;

  // Celular antigo, de oito casas: ganha o nono digito
  if (d.length === 10 && /^[1-9]{2}[6-9]/.test(d)) {
    return `${d.slice(0, 2)}9${d.slice(2)}`;
  }

  return d;
}

/**
 * Todas as formas em que aquele numero pode estar gravado.
 *
 * Usada na busca: procurar por esta lista acha o cliente esteja o cadastro
 * escrito do jeito antigo, do jeito novo, com ou sem o codigo do pais.
 */
export function variantesDoTelefone(valor: string): string[] {
  const base = normalizarTelefone(valor);
  if (!base) return [];

  const ddd = base.slice(0, 2);
  const resto = base.slice(2);

  const formas = new Set<string>([base, `55${base}`]);

  // Se e celular com nono digito, a forma antiga (sem o 9) tambem vale
  if (resto.length === 9 && resto.startsWith('9')) {
    const semNono = `${ddd}${resto.slice(1)}`;
    formas.add(semNono);
    formas.add(`55${semNono}`);
  }

  return [...formas];
}

/**
 * A forma como o telefone se le na tela.
 *
 * Passa pela forma canonica antes: o numero que o sistema antigo gravou sem o
 * nono digito ganha o 9 aqui e deixa de aparecer como se fosse fixo. Fixo de
 * verdade (comeca com 2 a 5) continua com oito casas.
 */
export function formatarTelefoneExibicao(valor: string | null | undefined): string {
  if (!valor) return '';
  const n = normalizarTelefone(valor);
  if (!n) return valor;
  if (n.length === 11) return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;
  return `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`;
}

/**
 * Diz se dois telefones sao o mesmo numero, escritos de jeitos diferentes.
 */
export function mesmoTelefone(a: string, b: string): boolean {
  const na = normalizarTelefone(a);
  const nb = normalizarTelefone(b);
  return !!na && na === nb;
}
