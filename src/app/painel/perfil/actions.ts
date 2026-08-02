'use server';

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSessionStaff } from '@/lib/staff-auth';
import { lojaAtual } from '@/lib/loja';
import { normalizarTelefone, variantesDoTelefone } from '@/lib/telefone';

const MIN_SENHA = 8;

/**
 * Troca a senha do profissional.
 *
 * Quando a senha foi definida pelo gestor (must_change_password), a atual nao
 * e cobrada: quem entregou a senha foi o gestor, e o objetivo e exatamente
 * tirar essa senha de circulacao. Nas demais trocas, a senha atual e conferida
 * para uma sessao esquecida aberta no celular nao virar troca de dono.
 */
export async function trocarMinhaSenha(dados: {
  senhaAtual?: string;
  novaSenha: string;
}) {
  const staff = await getSessionStaff();
  if (!staff) return { ok: false, error: 'Sessão expirada. Entre de novo.' };

  const nova = dados.novaSenha ?? '';
  if (nova.length < MIN_SENHA) {
    return { ok: false, error: `A senha precisa ter pelo menos ${MIN_SENHA} caracteres.` };
  }

  if (!staff.mustChangePassword) {
    if (!dados.senhaAtual) {
      return { ok: false, error: 'Informe a senha atual.' };
    }
    if (!staff.email) {
      return { ok: false, error: 'Seu cadastro está sem e-mail. Fale com a gestão.' };
    }

    // Cliente descartavel: conferir a senha atual nao pode mexer na sessao aberta
    const verificador = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );

    const { error: erroLogin } = await verificador.auth.signInWithPassword({
      email: staff.email,
      password: dados.senhaAtual,
    });

    if (erroLogin) return { ok: false, error: 'Senha atual incorreta.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: nova });
  if (error) return { ok: false, error: error.message };

  const admin = createAdminClient();
  await admin
    .from('staff')
    .update({ must_change_password: false })
    .eq('id', staff.staffId);

  revalidatePath('/painel', 'layout');
  return { ok: true };
}

/**
 * Liga a ficha de cliente ao mesmo login do profissional.
 *
 * Quem trabalha na barbearia tambem corta cabelo nela. O Jonathan e dono,
 * barbeiro e cliente ao mesmo tempo: quando outro barbeiro atende ele, aquilo e
 * uma comanda de verdade, com pagamento de verdade, e a comissao e do colega.
 *
 * Em vez de obrigar a pessoa a manter dois cadastros e dois logins, o mesmo
 * e-mail passa a abrir as duas portas. O que decide o que ela ve continua sendo
 * o mesmo de sempre: profissional ativo abre o painel, acesso de gestao abre o
 * admin, e ficha de cliente ligada a este login abre a area do cliente.
 *
 * A ficha nao e inventada: primeiro procura a que ja existe pelo telefone, que
 * e como o cadastro da casa identifica cliente. So cria quando nao ha nenhuma.
 */
export async function ativarMinhaContaDeCliente(dados: { telefone?: string } = {}) {
  const staff = await getSessionStaff();
  if (!staff) return { ok: false as const, error: 'Sessão expirada. Entre de novo.' };

  const admin = createAdminClient();

  // Já ligada: nada a fazer, e a tela só precisa saber disso
  const { data: jaLigada } = await admin
    .from('customers')
    .select('id, full_name')
    .eq('auth_user_id', staff.profileId)
    .maybeSingle();

  if (jaLigada) {
    return { ok: true as const, jaTinha: true, clienteId: jaLigada.id as string };
  }

  const telefone = normalizarTelefone(dados.telefone ?? '');
  if (!telefone) {
    return { ok: false as const, error: 'Informe seu telefone com DDD.' };
  }

  const nome = staff.fullName ?? staff.displayName;

  // Ficha que já existe com este telefone: liga a ela, para o histórico de
  // cortes que a pessoa já fez aqui continuar sendo dela.
  const { data: existente } = await admin
    .from('customers')
    .select('id, auth_user_id, active')
    .eq('barbershop_id', (await lojaAtual()))
    .in('phone', variantesDoTelefone(telefone))
    .limit(1)
    .maybeSingle();

  if (existente) {
    if (existente.auth_user_id && existente.auth_user_id !== staff.profileId) {
      return {
        ok: false as const,
        error: 'Este telefone já está ligado a outra conta de cliente. Fale com a gestão.',
      };
    }

    const { error } = await admin
      .from('customers')
      .update({ auth_user_id: staff.profileId, active: true })
      .eq('id', existente.id);

    if (error) return { ok: false as const, error: error.message };

    revalidatePath('/painel/perfil');
    return { ok: true as const, jaTinha: false, clienteId: existente.id as string };
  }

  const { data: criada, error } = await admin
    .from('customers')
    .insert({
      barbershop_id: (await lojaAtual()),
      full_name: nome,
      phone: telefone,
      email: staff.email ?? null,
      auth_user_id: staff.profileId,
      active: true,
      source: 'painel_barbeiro',
    })
    .select('id')
    .single();

  if (error) return { ok: false as const, error: error.message };

  revalidatePath('/painel/perfil');
  return { ok: true as const, jaTinha: false, clienteId: criada.id as string };
}
