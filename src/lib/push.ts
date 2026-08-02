/**
 * Aviso que toca no celular.
 *
 * Web Push: o navegador da pessoa guarda um "endereco" para receber recado, a
 * gente grava esse endereco e depois manda a mensagem assinada com a chave da
 * barbearia. Funciona com o aplicativo fechado.
 *
 * Duas coisas que valem lembrar:
 *
 *  - No iPhone so funciona se a pessoa tiver adicionado o aplicativo a tela de
 *    inicio. Aberto no Safari, o aviso nunca chega. Isso e regra da Apple, nao
 *    escolha nossa, e a tela de ativacao explica isso para o usuario.
 *
 *  - Aparelho que a pessoa apagou, ou navegador que perdeu a permissao,
 *    responde 404 ou 410. Quando isso acontece a linha e removida na hora: sem
 *    essa limpeza a tabela vira um cemiterio e cada aviso fica mais lento.
 */
import webpush from 'web-push';
import { createAdminClient } from '@/lib/supabase/admin';

import { lojaAtual } from '@/lib/loja';
let configurado = false;

/** Diz se a barbearia tem as chaves configuradas. Sem elas, push nao existe. */
export function pushLigado(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() &&
      process.env.VAPID_PRIVATE_KEY?.trim()
  );
}

function configurar() {
  if (configurado || !pushLigado()) return;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT?.trim() || 'mailto:contato@barbeariadojohnn.com',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!.trim(),
    process.env.VAPID_PRIVATE_KEY!.trim()
  );
  configurado = true;
}

export interface AvisoDeCelular {
  titulo: string;
  corpo: string;
  /** Para onde levar quando a pessoa tocar no aviso */
  url?: string;
  /**
   * Avisos com a mesma etiqueta se substituem no aparelho. Serve para o cliente
   * que remarca tres vezes nao empilhar tres avisos na tela de bloqueio.
   */
  etiqueta?: string;
}

/**
 * Toca no celular de uma pessoa, em todos os aparelhos dela.
 *
 * Nunca lanca erro: aviso que falha nao pode derrubar o agendamento, a comanda
 * ou o cancelamento que estava acontecendo.
 */
export async function tocarNoCelular(
  userId: string | null | undefined,
  aviso: AvisoDeCelular
): Promise<{ enviados: number; removidos: number }> {
  if (!userId || !pushLigado()) return { enviados: 0, removidos: 0 };

  try {
    configurar();
    const admin = createAdminClient();

    const { data: aparelhos } = await admin
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('user_id', userId);

    if (!aparelhos?.length) return { enviados: 0, removidos: 0 };

    const carga = JSON.stringify({
      title: aviso.titulo,
      body: aviso.corpo,
      url: aviso.url ?? '/',
      tag: aviso.etiqueta,
    });

    let enviados = 0;
    const mortos: string[] = [];

    await Promise.all(
      aparelhos.map(async (a) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: a.endpoint as string,
              keys: { p256dh: a.p256dh as string, auth: a.auth as string },
            },
            carga
          );
          enviados++;
        } catch (erro) {
          const status = (erro as { statusCode?: number })?.statusCode;
          // 404/410: o aparelho nao existe mais do outro lado
          if (status === 404 || status === 410) mortos.push(a.id as string);
        }
      })
    );

    if (mortos.length > 0) {
      await admin.from('push_subscriptions').delete().in('id', mortos);
    }

    if (enviados > 0) {
      await admin
        .from('push_subscriptions')
        .update({ last_used_at: new Date().toISOString() })
        .eq('user_id', userId);
    }

    return { enviados, removidos: mortos.length };
  } catch {
    return { enviados: 0, removidos: 0 };
  }
}

/**
 * Toca no celular de quem cuida da loja.
 *
 * Usado no que e assunto da casa e nao de uma pessoa so, como cliente novo
 * marcando pelo aplicativo.
 */
export async function tocarNaGestao(aviso: AvisoDeCelular): Promise<number> {
  if (!pushLigado()) return 0;

  try {
    const admin = createAdminClient();
    const { data: gestores } = await admin
      .from('staff')
      .select('profile_id')
      .eq('barbershop_id', (await lojaAtual()))
      .eq('active', true)
      .eq('can_manage', true)
      .is('fired_at', null);

    let total = 0;
    for (const g of gestores ?? []) {
      const r = await tocarNoCelular(g.profile_id as string, aviso);
      total += r.enviados;
    }
    return total;
  } catch {
    return 0;
  }
}

/** O login ligado a um cadastro de equipe, para saber em qual celular tocar. */
export async function loginDoProfissional(staffId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from('staff')
    .select('profile_id')
    .eq('id', staffId)
    .maybeSingle();
  return (data?.profile_id as string) ?? null;
}

/** O login ligado a uma ficha de cliente. Nem todo cliente tem conta. */
export async function loginDoCliente(customerId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from('customers')
    .select('auth_user_id')
    .eq('id', customerId)
    .maybeSingle();
  return (data?.auth_user_id as string) ?? null;
}
