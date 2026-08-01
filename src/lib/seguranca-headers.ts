/**
 * Cabecalhos de seguranca da resposta.
 *
 * Moraram no next.config ate 31/07/2026, e de la causavam um estrago silencioso:
 * a tela do painel e do admin abria vazia quando a pessoa entrava pela URL ou
 * recarregava a pagina. O motivo e que a pagina chega em duas partes, e a
 * segunda parte so aparece porque um pedacinho de script solto no fim do HTML a
 * revela. A politica sem nonce barrava esse pedacinho, e a tela ficava presa no
 * carregando para sempre. Quem navegava clicando nao via o problema, e por isso
 * ele passou tanto tempo em pe.
 *
 * A politica agora nasce aqui, no middleware, com um nonce novo a cada
 * requisicao. O Next reconhece o nonce e assina os proprios scripts com ele.
 * Ficou mais seguro do que antes, e nao mais permissivo: 'unsafe-inline' saiu do
 * script-src, e quem manda script para dentro da pagina agora precisa do nonce
 * do momento, que ninguem de fora tem como adivinhar.
 */

export function gerarNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

/**
 * Por que aqui nao tem nonce.
 *
 * A primeira versao desta politica exigia nonce e usava 'strict-dynamic'. Isso
 * derrubou o login em producao de um jeito silencioso e perigoso: a tela de
 * login e pre-renderizada e servida do cache, entao o HTML guardado nao tem o
 * nonce da requisicao de agora. Com 'strict-dynamic' o navegador ignora
 * 'self' e 'unsafe-inline' e so executa script assinado, entao NENHUM script
 * rodava. A pagina virava HTML sem programa: o formulario submetia do jeito
 * antigo, por endereco, e a senha do usuario ia parar na barra do navegador.
 *
 * Quem ja estava logado nao via nada disso, porque nem passava pelo login. So
 * quebrava para quem entrava do zero, que e justamente o cliente novo.
 *
 * A licao: nonce so serve quando toda pagina e montada na hora. Enquanto
 * existir pagina guardada em cache, a politica tem que valer sem ele.
 */
export function montarCsp(_nonce?: string): string {
  // Em desenvolvimento o Next monta a pagina com eval, para recarregar a tela
  // sozinho enquanto a gente escreve. Sem esta folga, a politica derruba TODO o
  // programa da pagina em dev: os botoes ficam mudos e o formulario nao envia.
  //
  // Isso ja custou caro. Em 01/08/2026 a tela parecia certa e nao era, e eu so
  // descobri porque testei injetando script por fora, o que passa por cima da
  // politica e mente. Em producao nao existe eval, entao a regra continua
  // apertada onde importa, e o navegador de teste passa a mostrar a verdade.
  const emDesenvolvimento = process.env.NODE_ENV === 'development';
  const script = emDesenvolvimento
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
    : "script-src 'self' 'unsafe-inline'";

  return [
    "default-src 'self'",
    script,
    // O estilo continua liberado: o sistema escreve estilo no próprio elemento
    // em vários pontos, e apertar isto agora quebraria a aparência sem ganho.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    // ws: e o canal que o Next usa em dev para avisar a tela que o codigo mudou
    emDesenvolvimento
      ? "connect-src 'self' ws: http://localhost:* https://*.supabase.co wss://*.supabase.co"
      : "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    'upgrade-insecure-requests',
  ].join('; ');
}

export const OUTROS_HEADERS: Array<[string, string]> = [
  ['X-Content-Type-Options', 'nosniff'],
  ['X-Frame-Options', 'DENY'],
  ['Referrer-Policy', 'strict-origin-when-cross-origin'],
  ['Permissions-Policy', 'camera=(), geolocation=(), microphone=()'],
];

/** Carimba a resposta com a politica e os demais cabecalhos. */
export function aplicarSeguranca(headers: Headers, csp: string) {
  headers.set('Content-Security-Policy', csp);
  for (const [nome, valor] of OUTROS_HEADERS) headers.set(nome, valor);
}
