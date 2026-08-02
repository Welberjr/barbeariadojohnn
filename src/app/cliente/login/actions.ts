'use server';

/**
 * Entrada do cliente: telefone ou e-mail.
 *
 * O cliente da barbearia sabe o telefone dele de cor e quase nunca lembra qual
 * e-mail deu no cadastro, ou nem deu nenhum. Entao a porta aceita os dois: quem
 * digita numero entra pelo numero, quem digita e-mail entra pelo e-mail.
 *
 * O login inteiro acontece aqui no servidor, e nao no navegador, por um motivo:
 * para entrar pelo telefone e preciso descobrir com qual e-mail aquela conta foi
 * criada, e esse e-mail e dado pessoal de outra pessoa. Resolvendo aqui, ele
 * nunca chega ao navegador de quem esta digitando.
 */

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { normalizarTelefone, variantesDoTelefone } from '@/lib/telefone';
import { lojaAtual } from '@/lib/loja';

/** O que a pessoa digitou parece um telefone? */
function pareceTelefone(valor: string): boolean {
  const digitos = valor.replace(/\D/g, '');
  return !valor.includes('@') && digitos.length >= 10;
}

export async function entrarComoCliente(dados: {
  identificador: string;
  senha: string;
}) {
  const digitado = (dados.identificador ?? '').trim();
  const senha = dados.senha ?? '';

  if (!digitado || !senha) {
    return { ok: false as const, error: 'Preencha o telefone (ou e-mail) e a senha.' };
  }

  let email = digitado.toLowerCase();

  if (pareceTelefone(digitado)) {
    const telefone = normalizarTelefone(digitado);
    if (!telefone) {
      return { ok: false as const, error: 'Telefone incompleto. Use DDD e número.' };
    }

    const admin = createAdminClient();
    const { data: fichas } = await admin
      .from('customers')
      .select('email, auth_user_id')
      .eq('barbershop_id', (await lojaAtual()))
      .in('phone', variantesDoTelefone(telefone))
      .not('auth_user_id', 'is', null)
      .limit(2);

    if (!fichas?.length) {
      return {
        ok: false as const,
        error: 'Não achei conta com este telefone. Confira o número ou fale com a barbearia.',
      };
    }

    // Dois cadastros com o mesmo numero: quem resolve e a barbearia, e nao o
    // sistema escolhendo um por conta propria e abrindo a conta errada.
    if (fichas.length > 1) {
      return {
        ok: false as const,
        error: 'Existe mais de um cadastro com este telefone. Fale com a barbearia.',
      };
    }

    if (!fichas[0].email) {
      return { ok: false as const, error: 'Seu cadastro está sem acesso. Fale com a barbearia.' };
    }

    email = fichas[0].email as string;
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password: senha });

  if (error) {
    return { ok: false as const, error: 'Telefone, e-mail ou senha incorretos.' };
  }

  return { ok: true as const };
}

/**
 * Diz se a pessoa ainda esta com a senha que a barbearia entregou.
 *
 * Enquanto for a senha padrao, a conta e de quem souber o telefone: a troca no
 * primeiro acesso e o que faz aquela conta virar dela mesma.
 */
export async function precisaTrocarSenha(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user?.user_metadata?.must_change_password === true;
}

/** Troca a senha e tira a marca de senha entregue pela barbearia. */
export async function trocarMinhaSenhaDeCliente(novaSenha: string) {
  const senha = novaSenha ?? '';
  if (senha.length < 6) {
    return { ok: false as const, error: 'A senha precisa ter pelo menos 6 caracteres.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false as const, error: 'Sessão expirada. Entre de novo.' };

  const { error } = await supabase.auth.updateUser({
    password: senha,
    data: { ...user.user_metadata, must_change_password: false },
  });

  if (error) return { ok: false as const, error: error.message };

  return { ok: true as const };
}
