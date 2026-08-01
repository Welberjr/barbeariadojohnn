'use server';

/**
 * Cadastro do cliente.
 *
 * Dois caminhos entram aqui:
 *
 *  1. Com convite: a barbearia mandou o link daquele cliente. A conta nasce
 *     ligada a ficha que ja existe, entao o historico, os pontos e a assinatura
 *     que ele ja tem aparecem no primeiro acesso.
 *
 *  2. Sem convite: alguem chegou pelo site. A conta nasce com ficha nova. NAO
 *     tentamos adivinhar pelo telefone: telefone nao e segredo, e quem soubesse
 *     o numero de um cliente entraria na ficha dele, veria o historico e usaria
 *     a assinatura que a pessoa paga.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { conviteValido } from '@/lib/convite-cliente';
import { BARBERSHOP_ID } from '@/lib/painel/dados';

const MIN_SENHA = 8;

function limparTelefone(valor: string): string | null {
  const digitos = valor.replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '');
  if (digitos.length < 10 || digitos.length > 11) return null;
  return digitos;
}

export async function cadastrarCliente(dados: {
  nome: string;
  telefone: string;
  email: string;
  senha: string;
  /** Identificador do cliente, quando veio por convite */
  clienteId?: string;
  /** Assinatura do convite */
  token?: string;
}) {
  const nome = dados.nome.trim().replace(/\s+/g, ' ');
  const email = dados.email.trim().toLowerCase();
  const senha = dados.senha ?? '';

  if (nome.length < 3) return { ok: false as const, error: 'Escreva seu nome completo.' };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { ok: false as const, error: 'E-mail inválido.' };
  }
  if (senha.length < MIN_SENHA) {
    return { ok: false as const, error: `A senha precisa ter pelo menos ${MIN_SENHA} caracteres.` };
  }

  const telefone = limparTelefone(dados.telefone ?? '');
  if (!telefone) return { ok: false as const, error: 'Telefone incompleto. Use DDD e número.' };

  const admin = createAdminClient();

  // Convite: so vale se a assinatura conferir, e so para ficha ainda sem dono
  let fichaExistente: { id: string; auth_user_id: string | null } | null = null;

  if (dados.clienteId) {
    if (!conviteValido(dados.clienteId, dados.token)) {
      return { ok: false as const, error: 'Este convite não é válido. Peça um novo à barbearia.' };
    }

    const { data } = await admin
      .from('customers')
      .select('id, auth_user_id')
      .eq('id', dados.clienteId)
      .eq('barbershop_id', BARBERSHOP_ID)
      .maybeSingle();

    if (!data) return { ok: false as const, error: 'Cadastro não encontrado.' };

    if (data.auth_user_id) {
      return {
        ok: false as const,
        error: 'Esta ficha já tem uma conta. Entre com o e-mail e a senha que você criou.',
      };
    }

    fichaExistente = data as { id: string; auth_user_id: string | null };
  }

  // O e-mail so pode pertencer a uma conta
  const { data: usuarios } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (usuarios?.users?.some((u) => u.email?.toLowerCase() === email)) {
    return {
      ok: false as const,
      error: 'Já existe uma conta com este e-mail. Tente entrar, ou use outro e-mail.',
    };
  }

  const { data: criado, error: erroConta } = await admin.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
    user_metadata: { role: 'customer', full_name: nome },
  });

  if (erroConta || !criado?.user) {
    return { ok: false as const, error: erroConta?.message ?? 'Não foi possível criar a conta.' };
  }

  if (fichaExistente) {
    // Liga na ficha que ja existe, sem apagar o que a barbearia ja sabe dele.
    // A condicao de auth_user_id nulo impede dois convites simultaneos criarem
    // duas contas para a mesma ficha.
    const { data: ligada } = await admin
      .from('customers')
      .update({ auth_user_id: criado.user.id, email, active: true })
      .eq('id', fichaExistente.id)
      .is('auth_user_id', null)
      .select('id')
      .maybeSingle();

    if (!ligada) {
      await admin.auth.admin.deleteUser(criado.user.id);
      return { ok: false as const, error: 'Esta ficha acabou de receber uma conta. Tente entrar.' };
    }

    return { ok: true as const, jaEraCliente: true };
  }

  // Sem convite: ficha nova
  const { error: erroFicha } = await admin.from('customers').insert({
    barbershop_id: BARBERSHOP_ID,
    full_name: nome,
    phone: telefone,
    email,
    auth_user_id: criado.user.id,
    active: true,
    source: 'aplicativo',
  });

  if (erroFicha) {
    // Conta sem ficha nao abre nada: desfaz para a pessoa poder tentar de novo
    await admin.auth.admin.deleteUser(criado.user.id);
    return { ok: false as const, error: erroFicha.message };
  }

  return { ok: true as const, jaEraCliente: false };
}

/** Dados que a tela mostra quando o cliente chega por convite. */
export async function clienteDoConvite(clienteId: string, token: string) {
  if (!conviteValido(clienteId, token)) return null;

  const admin = createAdminClient();
  const { data } = await admin
    .from('customers')
    .select('id, full_name, phone, email, auth_user_id, total_appointments, loyalty_points')
    .eq('id', clienteId)
    .eq('barbershop_id', BARBERSHOP_ID)
    .maybeSingle();

  if (!data) return null;

  return {
    id: data.id as string,
    nome: (data.full_name as string) ?? '',
    telefone: (data.phone as string) ?? '',
    email: (data.email as string) ?? '',
    jaTemConta: !!data.auth_user_id,
    visitas: Number(data.total_appointments ?? 0),
    pontos: Number(data.loyalty_points ?? 0),
  };
}
