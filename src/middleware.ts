import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';
import { montarCsp, aplicarSeguranca } from '@/lib/seguranca-headers';

export async function middleware(request: NextRequest) {
  // A politica de seguranca sai daqui, e nao do next.config: la ela entrava no
  // build e barrava o pedacinho de script que revela a segunda parte da pagina,
  // deixando o painel preso no carregando para quem entrava pela URL.
  //
  // Ela nao leva nonce, e isso e de proposito. Ver a explicacao em
  // seguranca-headers.ts: com pagina guardada em cache, nonce derruba o login.
  const csp = montarCsp();

  // Endpoints de API tem autenticacao propria (CRON_SECRET, verify_token) e nao
  // precisam do refresh de sessao.
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const resposta = NextResponse.next({ request });
    aplicarSeguranca(resposta.headers, csp);
    return resposta;
  }

  const resposta = await updateSession(request);
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
