'use server';

/**
 * Guardar e esquecer o aparelho que recebe aviso.
 *
 * Fica na raiz de propósito: o mesmo botao serve para o barbeiro, para a
 * gestao e para o cliente. Quem decide o que a pessoa recebe e o cadastro dela,
 * nao a tela por onde ela ligou o aviso.
 */
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

const BARBERSHOP_ID = '11111111-1111-1111-1111-111111111111';

export async function guardarAparelho(dados: {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, error: 'Entre na sua conta para receber avisos.' };
  if (!dados.endpoint || !dados.p256dh || !dados.auth) {
    return { ok: false, error: 'O navegador não devolveu os dados do aparelho.' };
  }

  const admin = createAdminClient();

  // O mesmo aparelho pode trocar de dono: o barbeiro empresta o celular da loja
  // para o colega, o cliente entra com outra conta no mesmo navegador. Quem
  // manda e o login de agora.
  const { error } = await admin.from('push_subscriptions').upsert(
    {
      barbershop_id: BARBERSHOP_ID,
      user_id: user.id,
      endpoint: dados.endpoint,
      p256dh: dados.p256dh,
      auth: dados.auth,
      user_agent: dados.userAgent ?? null,
    },
    { onConflict: 'endpoint' }
  );

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function esquecerAparelho(endpoint: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, error: 'Entre na sua conta.' };

  const admin = createAdminClient();
  await admin
    .from('push_subscriptions')
    .delete()
    .eq('endpoint', endpoint)
    .eq('user_id', user.id);

  return { ok: true };
}
