/**
 * Sistema de notificacoes unificado.
 *
 * Toda notificacao e gravada na tabela `notifications` (aparece no painel do
 * cliente) e entra na fila de WhatsApp (`whatsapp_status = pending`).
 * O envio real tenta usar lib/whatsapp (hoje mock ate a integracao Z-API).
 * Quando o Z-API entrar, basta trocar o transporte em lib/whatsapp.ts e,
 * opcionalmente, criar um worker que consome as pendentes.
 */
import { createAdminClient } from '@/lib/supabase/admin';
import { sendWhatsAppMessage } from '@/lib/whatsapp';

import { lojaAtual } from '@/lib/loja';
export type NotificationType =
  | 'agendamento_confirmado'
  | 'agendamento_cancelado'
  /** Pedido de confirmacao de presenca, respondido dentro do aplicativo */
  | 'confirmacao_pedida'
  | 'assinatura_pagamento'
  | 'assinatura_uso'
  | 'assinatura_fora_dias'
  | 'assinatura_criada'
  | 'pontos_ganhos'
  | 'geral';

export interface NotifyInput {
  customerId: string;
  type: NotificationType;
  title: string;
  body: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata?: Record<string, any>;
  /** Quando false, nao tenta WhatsApp (fica so no painel). Default: true */
  whatsapp?: boolean;
}

/**
 * Cria a notificacao no painel e tenta enviar WhatsApp (best effort).
 * Nunca lanca erro: notificacao falhar nao pode quebrar o fluxo principal.
 */
export async function notifyCustomer(input: NotifyInput) {
  try {
    const admin = createAdminClient();

    // A loja do aviso e a da FICHA de quem vai receber, nao a de quem esta
    // logado. Este aviso nasce em tres situacoes diferentes: o cliente mexendo
    // na propria agenda, a recepcao mexendo por ele, e a tarefa da madrugada,
    // que nao tem ninguem logado. Sem perguntar a ficha, o aviso da tarefa
    // nasceria carimbado na loja errada quando a rede tiver mais de uma.
    const { data: dono } = await admin
      .from('customers')
      .select('barbershop_id')
      .eq('id', input.customerId)
      .maybeSingle();

    const { data: created, error } = await admin
      .from('notifications')
      .insert({
        barbershop_id: (dono?.barbershop_id as string) ?? (await lojaAtual()),
        customer_id: input.customerId,
        type: input.type,
        title: input.title,
        body: input.body,
        metadata: input.metadata ?? {},
        whatsapp_status: input.whatsapp === false ? 'skipped' : 'pending',
      })
      .select('id')
      .single();

    if (error || !created) return;

    if (input.whatsapp === false) return;

    // Best effort de WhatsApp (mock ate Z-API ser configurado)
    const { data: customer } = await admin
      .from('customers')
      .select('phone')
      .eq('id', input.customerId)
      .maybeSingle();

    if (!customer?.phone) {
      await admin
        .from('notifications')
        .update({ whatsapp_status: 'skipped' })
        .eq('id', created.id);
      return;
    }

    const result = await sendWhatsAppMessage(
      customer.phone,
      `*${input.title}*\n\n${input.body}`
    );

    await admin
      .from('notifications')
      .update({
        whatsapp_status: result.ok ? (result.mocked ? 'pending' : 'sent') : 'failed',
        whatsapp_sent_at:
          result.ok && !result.mocked ? new Date().toISOString() : null,
      })
      .eq('id', created.id);
  } catch {
    // silencioso de proposito
  }
}

export async function getUnreadCount(customerId: string): Promise<number> {
  const admin = createAdminClient();
  const { count } = await admin
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('customer_id', customerId)
    .is('read_at', null);
  return count ?? 0;
}
