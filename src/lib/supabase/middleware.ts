/**
 * Supabase Middleware — Refresh de sessão Auth + roteamento por papel
 *
 * Papéis:
 *  - Equipe/admin: usuários sem user_metadata.role (fluxo original /login -> /admin)
 *  - Clientes: user_metadata.role === 'customer' (fluxo /cliente/login -> /cliente)
 *
 * Regras:
 *  - /admin exige login e NUNCA aceita cliente (cliente é mandado pro /cliente)
 *  - /cliente exige login (exceto /cliente/login)
 *  - Logado tentando acessar telas de login é redirecionado pro painel certo
 */
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getSession() le o JWT do cookie local (sem roundtrip de rede)
  // Mais rapido que getUser() para verificacao de autenticacao no middleware
  // O getUser() completo acontece no layout (server component) quando necessario
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user ?? null;

  const pathname = request.nextUrl.pathname;
  const isCustomerUser = user?.user_metadata?.role === 'customer';

  const isAdminRoute = pathname.startsWith('/admin');
  const isAdminLogin = pathname.startsWith('/login');
  const isCustomerLogin = pathname.startsWith('/cliente/login');
  const isCustomerRoute = pathname.startsWith('/cliente') && !isCustomerLogin;

  function redirectTo(path: string) {
    const url = request.nextUrl.clone();
    url.pathname = path;
    url.search = '';
    return NextResponse.redirect(url);
  }

  // ----- Area administrativa -----
  if (isAdminRoute) {
    if (!user) return redirectTo('/login');
    if (isCustomerUser) return redirectTo('/cliente');
  }

  // ----- Painel do cliente -----
  if (isCustomerRoute && !user) {
    return redirectTo('/cliente/login');
  }

  // ----- Telas de login com sessao ativa -----
  if (isAdminLogin && user) {
    return redirectTo(isCustomerUser ? '/cliente' : '/admin');
  }
  if (isCustomerLogin && user) {
    return redirectTo(isCustomerUser ? '/cliente' : '/admin');
  }

  return supabaseResponse;
}
