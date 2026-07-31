import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';
import { gerarNonce, montarCsp, aplicarSeguranca } from '@/lib/seguranca-headers';

export async function middleware(request: NextRequest) {
  // A politica de seguranca nasce aqui, uma por requisicao, com nonce proprio.
  // O Next le a politica no cabecalho da requisicao, tira o nonce dela e assina
  // os proprios scripts. Sem esse caminho, a segunda parte da pagina nunca
  // aparecia e a tela ficava presa no carregando.
  const nonce = gerarNonce();
  const csp = montarCsp(nonce);

  const cabecalhos = new Headers(request.headers);
  cabecalhos.set('x-nonce', nonce);
  cabecalhos.set('Content-Security-Policy', csp);

  const pedido = { headers: cabecalhos };

  // Endpoints de API tem autenticacao propria (CRON_SECRET, verify_token) e nao
  // precisam do refresh de sessao.
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const resposta = NextResponse.next({ request: pedido });
    aplicarSeguranca(resposta.headers, csp);
    return resposta;
  }

  const resposta = await updateSession(request, pedido);
  aplicarSeguranca(resposta.headers, csp);
  return resposta;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public assets (images, fonts, etc.)
     */
    '/((?!_next/static|_next/image|_next/data|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
