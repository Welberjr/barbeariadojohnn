'use server';

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSessionStaff } from '@/lib/staff-auth';

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
