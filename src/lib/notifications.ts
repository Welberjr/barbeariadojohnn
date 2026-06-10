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

const BARBERSHOP_ID = '11111111-1111-1111-1111-111111111111';

export type NotificationType =
  | 'agendamento_confirmado'
  | 'agendamento_cancelado'
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

    const { data: created, error } = await admin
      .from('notifications')
      .insert({
        barbershop_id: BARBERSHOP_ID,
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
