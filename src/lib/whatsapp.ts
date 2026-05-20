/**
 * WhatsApp integration helper.
 *
 * Por enquanto:
 * - Se whatsapp_config.meta_status !== 'verified': retorna mock (log apenas)
 * - Se whatsapp_config.meta_status === 'verified': chama Meta Cloud API real
 *
 * Quando Meta Business Manager aprovar a verificação, basta:
 * 1. Salvar credenciais em /admin/whatsapp
 * 2. Mudar status para 'verified'
 * 3. Esta função passa a enviar mensagens reais automaticamente
 */

import { createAdminClient } from '@/lib/supabase/admin';

const BARBERSHOP_ID = '11111111-1111-1111-1111-111111111111';
const META_API_BASE = 'https://graph.facebook.com/v19.0';

interface WhatsAppConfig {
  enabled?: boolean;
  phone_number_id?: string;
  access_token?: string;
  meta_status?: string;
}

export interface SendMessageResult {
  ok: boolean;
  mocked: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Sanitize phone number to international format (E.164 without +).
 * Examples:
 *   "(61) 9 9264-3078" -> "5561992643078"
 *   "61992643078" -> "5561992643078"
 *   "+5561992643078" -> "5561992643078"
 *   "5561992643078" -> "5561992643078"
 */
export function normalizePhoneE164(input: string): string {
  if (!input) return '';
  const digits = input.replace(/\D/g, '');
  // Se já começa com 55 e tem 12-13 dígitos, está pronto
  if (digits.length === 12 || digits.length === 13) {
    if (digits.startsWith('55')) return digits;
  }
  // Se tem 10-11 dígitos, é local brasileiro — prepend 55
  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }
  return digits;
}

/**
 * Send a WhatsApp text message.
 *
 * @param to - Phone number in any format (will be normalized to E.164 without +)
 * @param message - Text content (max 4096 chars)
 * @returns SendMessageResult with mocked flag indicating if it was a real send
 */
export async function sendWhatsAppMessage(
  to: string,
  message: string
): Promise<SendMessageResult> {
  const admin = createAdminClient();

  const { data: bs } = await admin
    .from('barbershops')
    .select('whatsapp_config')
    .eq('id', BARBERSHOP_ID)
    .maybeSingle();

  const cfg = (bs?.whatsapp_config ?? {}) as WhatsAppConfig;
  const normalizedTo = normalizePhoneE164(to);

  // Mock se não está totalmente configurado
  if (
    !cfg.enabled ||
    cfg.meta_status !== 'verified' ||
    !cfg.phone_number_id ||
    !cfg.access_token
  ) {
    // Em desenvolvimento ou pre-verificação: apenas loga
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.log(
        `[WhatsApp MOCK] Para: ${normalizedTo} | Mensagem: ${message.substring(0, 80)}${message.length > 80 ? '...' : ''}`
      );
    }
    return {
      ok: true,
      mocked: true,
      messageId: `mock_${Date.now()}`,
    };
  }

  // ENVIO REAL via Meta Cloud API
  try {
    const url = `${META_API_BASE}/${cfg.phone_number_id}/messages`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: normalizedTo,
        type: 'text',
        text: { body: message.substring(0, 4096) },
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      return {
        ok: false,
        mocked: false,
        error: `Meta API ${response.status}: ${errBody.substring(0, 200)}`,
      };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await response.json();
    const messageId = data?.messages?.[0]?.id ?? `unknown_${Date.now()}`;

    return {
      ok: true,
      mocked: false,
      messageId,
    };
  } catch (err) {
    return {
      ok: false,
      mocked: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Template de lembrete de agendamento (24h antes).
 */
export function reminderTemplate24h(opts: {
  customerName: string;
  serviceName: string;
  dateTime: Date;
  barbershopName: string;
}): string {
  const dateStr = opts.dateTime.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const timeStr = opts.dateTime.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return `Olá ${opts.customerName}! 🪒\n\nLembrete: você tem ${opts.serviceName} agendado para *amanhã, ${dateStr} às ${timeStr}* na ${opts.barbershopName}.\n\nNos vemos lá! Se precisar reagendar, é só responder essa mensagem.`;
}

/**
 * Template de confirmação de agendamento (imediato).
 */
export function confirmationTemplate(opts: {
  customerName: string;
  serviceName: string;
  dateTime: Date;
  barbershopName: string;
  staffName?: string;
}): string {
  const dateStr = opts.dateTime.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  });
  const timeStr = opts.dateTime.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const withStaff = opts.staffName ? ` com *${opts.staffName}*` : '';

  return `Olá ${opts.customerName}! ✂️\n\nAgendamento confirmado na ${opts.barbershopName}:\n\n📅 ${dateStr}\n🕐 ${timeStr}\n💈 ${opts.serviceName}${withStaff}\n\nObrigado pela preferência! Caso precise reagendar, é só responder essa mensagem.`;
}
