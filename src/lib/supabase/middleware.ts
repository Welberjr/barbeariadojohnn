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

/**
 * Diz se este login tem ficha de cliente ligada a ele.
 *
 * Sem esta pergunta nascia um vai e vem sem fim: quem estava logado e nao tinha
 * ficha era mandado para a area do cliente, que devolvia para o login, que
 * mandava de volta para a area do cliente. E o "redirecionamento em excesso" que
 * o navegador acaba mostrando.
 */
async function temFichaDeCliente(userId: string): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/^﻿/, '').trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.replace(/^﻿/, '').trim();
  if (!url || !key) return false;

  try {
    const res = await fetch(
      `${url}/rest/v1/customers?select=id&auth_user_id=eq.${userId}&active=is.true&limit=1`,
      {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
        cache: 'no-store',
      }
    );
    if (!res.ok) return false;
    return ((await res.json()) as unknown[]).length > 0;
  } catch {
    return false;
  }
}

export async function updateSession(
  request: NextRequest,
  /** Cabecalhos que o middleware quer entregar ao render, com o nonce dentro */
  pedido: { headers: Headers } | undefined = undefined
) {
  const requisicao = pedido ?? request;

  let supabaseResponse = NextResponse.next({
    request: requisicao,
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
            request: requisicao,
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

  // O cadastro mora embaixo de /cliente, mas e a porta de entrada de quem ainda
  // nao tem conta. Sem esta excecao ele era mandado para o login, ou seja: a
  // unica tela que serve para quem nao esta logado exigia estar logado.
  const isCustomerCadastro = pathname.startsWith('/cliente/cadastro');

  const isCustomerRoute =
    pathname.startsWith('/cliente') && !isCustomerLogin && !isCustomerCadastro;

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
  // Nao decidimos aqui por qual porta a pessoa entra: quem sabe disso e /entrar,
  // que conhece todos os papeis dela. Uma porta so, entra direto; mais de uma,
  // ela escolhe. Antes o dono que tambem corta cabelo caia sempre na gestao e
  // tinha que procurar o caminho de volta.
  if ((isAdminLogin || isCustomerLogin) && user) {
    const acesso = await fetchStaffAccess(user.id);
    if (acesso.isStaff || (await temFichaDeCliente(user.id))) {
      return redirectTo('/entrar');
    }

    // Sessao sem cadastro nenhum fica onde esta, senao nasce um vai e vem sem fim
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
