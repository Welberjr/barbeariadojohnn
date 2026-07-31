/**
 * Supabase Middleware · Refresh de sessão Auth + roteamento por papel
 *
 * Papéis:
 *  - Gestão: profissional com staff.can_manage = true (fluxo /login -> /admin)
 *  - Equipe sem gestão: demais profissionais ativos (fluxo /login -> /painel)
 *  - Clientes: user_metadata.role === 'customer' (fluxo /cliente/login -> /cliente)
 *
 * Regras:
 *  - /admin exige acesso de gestão conferido no banco, nunca só o token.
 *    Como server action é POST na própria rota, esta trava também protege as
 *    ações do admin, além da guarda que cada action tem por dentro.
 *  - /painel exige profissional ativo
 *  - Logado tentando acessar telas de login é redirecionado pro painel certo
 */
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

interface StaffAccess {
  isStaff: boolean;
  canManage: boolean;
}

/**
 * Confere o acesso direto no banco. É uma consulta por navegação em área
 * logada, e é o que faz profissional desligado perder o acesso na hora.
 */
async function fetchStaffAccess(userId: string): Promise<StaffAccess> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/^﻿/, '').trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.replace(/^﻿/, '').trim();
  if (!url || !key) return { isStaff: false, canManage: false };

  try {
    const res = await fetch(
      `${url}/rest/v1/staff?select=can_manage&profile_id=eq.${userId}&active=is.true&fired_at=is.null&limit=1`,
      {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
        cache: 'no-store',
      }
    );
    if (!res.ok) return { isStaff: false, canManage: false };
    const rows = (await res.json()) as Array<{ can_manage: boolean }>;
    if (!rows.length) return { isStaff: false, canManage: false };
    return { isStaff: true, canManage: rows[0].can_manage === true };
  } catch {
    // Falha de rede não pode virar porta aberta
    return { isStaff: false, canManage: false };
  }
}

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
  const isPanelRoute = pathname.startsWith('/painel');
  const isAdminLogin = pathname.startsWith('/login');
  const isCustomerLogin = pathname.startsWith('/cliente/login');
  const isCustomerRoute = pathname.startsWith('/cliente') && !isCustomerLogin;

  /**
   * Conta redirecionamentos seguidos.
   *
   * Cookie de sessao quebrado ainda existe no navegador de quem ja passou pelo
   * problema, e um navegador nunca se cura sozinho: ele repete o mesmo cookie
   * podre em toda tentativa. Passando de tres saltos seguidos, a sessao e
   * apagada e a pessoa cai no login limpa, em vez de bater na parede do
   * "redirecionamento em excesso".
   */
  const saltos = Number(request.cookies.get('bj_saltos')?.value ?? 0);

  /** Apaga o cookie de sessao do Supabase, que vem partido em pedacos. */
  function limparSessao(resposta: NextResponse) {
    for (const cookie of request.cookies.getAll()) {
      if (cookie.name.startsWith('sb-')) {
        resposta.cookies.set(cookie.name, '', { maxAge: 0, path: '/' });
      }
    }
  }

  function redirectTo(path: string) {
    const url = request.nextUrl.clone();
    url.pathname = path;
    url.search = '';
    const resposta = NextResponse.redirect(url);

    // Leva junto o cookie de sessao renovado.
    // Sem isto, quando o token de uma hora vence, a sessao e renovada aqui mas
    // o cookie novo morre com a resposta descartada. O navegador continua com o
    // cookie velho, ja consumido, e as telas ficam trocando redirecionamento
    // entre si ate o navegador desistir com "redirecionamento em excesso".
    for (const cookie of supabaseResponse.cookies.getAll()) {
      resposta.cookies.set(cookie);
    }

    if (saltos >= 3) {
      limparSessao(resposta);
      resposta.cookies.set('bj_saltos', '', { maxAge: 0, path: '/' });
      const login = request.nextUrl.clone();
      login.pathname = isCustomerRoute || isCustomerLogin ? '/cliente/login' : '/login';
      login.search = '';
      const paraLogin = NextResponse.redirect(login);
      limparSessao(paraLogin);
      paraLogin.cookies.set('bj_saltos', '', { maxAge: 0, path: '/' });
      return paraLogin;
    }

    resposta.cookies.set('bj_saltos', String(saltos + 1), { maxAge: 10, path: '/' });
    return resposta;
  }

  // ----- Areas da equipe -----
  if (isAdminRoute || isPanelRoute) {
    if (!user) return redirectTo('/login');

    const acesso = await fetchStaffAccess(user.id);

    // Quem trabalha aqui entra, mesmo que o login tenha nascido como cliente.
    // E o caso de quem era freguês da casa e passou a trabalhar nela: o papel
    // que vale e o cadastro de hoje, nao a etiqueta de quando a conta nasceu.
    if (!acesso.isStaff) {
      return redirectTo(isCustomerUser ? '/cliente' : '/login');
    }

    if (isAdminRoute && !acesso.canManage) return redirectTo('/painel');
  }

  // ----- Painel do cliente -----
  if (isCustomerRoute && !user) {
    return redirectTo('/cliente/login');
  }

  // ----- Telas de login com sessao ativa -----
  // Quem tem os dois papeis cai no lado do trabalho, que e onde passa o dia. A
  // conta de cliente fica a um toque, no perfil.
  if ((isAdminLogin || isCustomerLogin) && user) {
    const acesso = await fetchStaffAccess(user.id);
    if (acesso.isStaff) return redirectTo(acesso.canManage ? '/admin' : '/painel');
    if (isCustomerUser) return redirectTo('/cliente');
    return entregar();
  }

  return entregar();

  /** Tela entregue de verdade: a contagem de saltos morre aqui. */
  function entregar() {
    if (saltos > 0) {
      supabaseResponse.cookies.set('bj_saltos', '', { maxAge: 0, path: '/' });
    }
    return supabaseResponse;
  }
}
