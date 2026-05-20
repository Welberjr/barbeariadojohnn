export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Webhook do WhatsApp Cloud API.
 *
 * GET: Handshake de verificaÃ§Ã£o Meta (compara hub.verify_token com config)
 * POST: Recebe eventos (mensagens, status de entrega, leitura, etc.)
 *
 * Por enquanto: apenas valida e loga. Quando integraÃ§Ã£o estiver ativa,
 * processa fluxo conversacional (agendamentos via WhatsApp).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

const BARBERSHOP_ID = '11111111-1111-1111-1111-111111111111';

interface WhatsAppConfig {
  verify_token?: string;
  enabled?: boolean;
  meta_status?: string;
}

/**
 * Handshake da Meta â€” Meta envia GET com hub.mode=subscribe, hub.verify_token e hub.challenge.
 * Devemos retornar o challenge se o verify_token confere.
 */
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode !== 'subscribe' || !token || !challenge) {
    return NextResponse.json(
      { error: 'Bad request' },
      { status: 400 }
    );
  }

  try {
    const admin = createAdminClient();
    const { data: bs } = await admin
      .from('barbershops')
      .select('whatsapp_config')
      .eq('id', BARBERSHOP_ID)
      .maybeSingle();

    const cfg = (bs?.whatsapp_config ?? {}) as WhatsAppConfig;

    if (cfg.verify_token && token === cfg.verify_token) {
      // Retorna challenge em texto puro (nÃ£o JSON)
      return new NextResponse(challenge, {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      });
    }

    return NextResponse.json(
      { error: 'Verify token mismatch' },
      { status: 403 }
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    );
  }
}

/**
 * Recebe eventos da Meta (mensagens recebidas, status de entrega/leitura).
 * Por enquanto: apenas loga payload. ImplementaÃ§Ã£o completa de fluxo
 * conversacional virÃ¡ quando Meta verificar a conta.
 */
export async function POST(req: NextRequest) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body: any = await req.json();

    // Log estrutura recebida (em produÃ§Ã£o, isso vai pro Vercel Logs)
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.log('[WhatsApp Webhook] Payload:', JSON.stringify(body, null, 2));
    }

    // Estrutura esperada da Meta:
    // {
    //   object: 'whatsapp_business_account',
    //   entry: [{
    //     changes: [{
    //       value: {
    //         messages: [{ from, text: { body }, ... }],
    //         statuses: [{ id, status, ... }]
    //       }
    //     }]
    //   }]
    // }

    if (body?.object !== 'whatsapp_business_account') {
      // NÃ£o Ã© um evento WhatsApp â€” ignora
      return NextResponse.json({ ok: true });
    }

    const admin = createAdminClient();

    // Verifica se a integraÃ§Ã£o estÃ¡ ativa antes de processar
    const { data: bs } = await admin
      .from('barbershops')
      .select('whatsapp_config')
      .eq('id', BARBERSHOP_ID)
      .maybeSingle();

    const cfg = (bs?.whatsapp_config ?? {}) as WhatsAppConfig;
    if (!cfg.enabled || cfg.meta_status !== 'verified') {
      // IntegraÃ§Ã£o ainda nÃ£o ativa â€” sÃ³ acknowledge
      return NextResponse.json({ ok: true, skipped: 'not_active' });
    }

    // Processa mensagens recebidas
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const entries: any[] = Array.isArray(body.entry) ? body.entry : [];
    for (const entry of entries) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const changes: any[] = Array.isArray(entry.changes) ? entry.changes : [];
      for (const change of changes) {
        const value = change.value;
        if (!value) continue;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const messages: any[] = Array.isArray(value.messages) ? value.messages : [];
        for (const msg of messages) {
          // TODO Semana 7+: implementar fluxo conversacional
          // - Identificar cliente pelo telefone
          // - Interpretar intent (agendar, cancelar, status, etc.)
          // - Responder com sendWhatsAppMessage
          //
          // Por enquanto, registra contato na tabela de transactions/logs para auditoria
          if (process.env.NODE_ENV !== 'production') {
            // eslint-disable-next-line no-console
            console.log(
              '[WhatsApp Webhook] Mensagem recebida:',
              msg.from,
              msg.text?.body
            );
          }
        }
      }
    }

    // Meta espera 200 dentro de 5s, senÃ£o tenta reentregar
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : 'Internal error',
      },
      { status: 500 }
    );
  }
}
