export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Webhook do WhatsApp Cloud API.
 *
 * GET: Handshake de verificação Meta (compara hub.verify_token com config)
 * POST: Recebe eventos (mensagens, status de entrega) e roda fluxo conversacional
 *
 * Fluxo conversacional (state machine baseada em texto numerico):
 *   idle -> menu principal
 *   awaiting_menu -> "1" agendar / "2" meus agendamentos / "3" falar com atendente
 *   awaiting_service -> escolher servico (lista numerada)
 *   awaiting_date -> escolher data (proximos 7 dias)
 *   awaiting_time -> escolher horario disponivel
 *   awaiting_confirm -> "1" confirma / "2" cancela
 *
 * Contexto da sessao salvo em whatsapp_sessions.context (jsonb).
 * Toda mensagem (in/out) e registrada em whatsapp_messages.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  sendWhatsAppMessage,
  normalizePhoneE164,
  confirmationTemplate,
} from '@/lib/whatsapp';

const BARBERSHOP_ID = '11111111-1111-1111-1111-111111111111';

interface WhatsAppConfig {
  verify_token?: string;
  enabled?: boolean;
  meta_status?: string;
}

// ============================================================================
// GET - Handshake Meta
// ============================================================================
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode !== 'subscribe' || !token || !challenge) {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
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

// ============================================================================
// POST - Eventos da Meta + fluxo conversacional
// ============================================================================
export async function POST(req: NextRequest) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body: any = await req.json();

    if (body?.object !== 'whatsapp_business_account') {
      return NextResponse.json({ ok: true, skipped: 'not_whatsapp_event' });
    }

    const admin = createAdminClient();
    const { data: bs } = await admin
      .from('barbershops')
      .select('whatsapp_config')
      .eq('id', BARBERSHOP_ID)
      .maybeSingle();

    const cfg = (bs?.whatsapp_config ?? {}) as WhatsAppConfig;
    if (!cfg.enabled || cfg.meta_status !== 'verified') {
      return NextResponse.json({ ok: true, skipped: 'not_active' });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const entries: any[] = Array.isArray(body.entry) ? body.entry : [];
    for (const entry of entries) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const changes: any[] = Array.isArray(entry.changes) ? entry.changes : [];
      for (const change of changes) {
        const value = change.value;
        if (!value) continue;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const messages: any[] = Array.isArray(value.messages)
          ? value.messages
          : [];

        for (const msg of messages) {
          if (msg.type !== 'text' || !msg.text?.body) continue;
          await handleIncomingMessage({
            from: String(msg.from ?? ''),
            text: String(msg.text.body ?? '').trim(),
            metaMessageId: String(msg.id ?? ''),
          });
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// HANDLER PRINCIPAL DE MENSAGEM
// ============================================================================
async function handleIncomingMessage(input: {
  from: string;
  text: string;
  metaMessageId: string;
}) {
  const admin = createAdminClient();
  const phone = normalizePhoneE164(input.from);

  // Loga mensagem recebida
  await admin.from('whatsapp_messages').insert({
    barbershop_id: BARBERSHOP_ID,
    direction: 'in',
    phone,
    body: input.text,
    meta_message_id: input.metaMessageId,
    status: 'received',
  });

  // Busca/cria sessao
  const session = await getOrCreateSession(phone);
  const text = input.text.toLowerCase().trim();

  // Comandos globais (funcionam em qualquer estado)
  if (
    text === 'menu' ||
    text === 'voltar' ||
    text === 'cancelar' ||
    text === 'sair' ||
    text === 'oi' ||
    text === 'ola' ||
    text === 'olá'
  ) {
    await updateSession(session.id, 'awaiting_menu', {});
    await sendAndLog(phone, menuMessage(), session.id);
    return;
  }

  // Roteamento por estado
  switch (session.state) {
    case 'idle':
      await updateSession(session.id, 'awaiting_menu', {});
      await sendAndLog(phone, menuMessage(), session.id);
      break;

    case 'awaiting_menu':
      await handleMenuChoice(text, session, phone);
      break;

    case 'awaiting_service':
      await handleServiceChoice(text, session, phone);
      break;

    case 'awaiting_date':
      await handleDateChoice(text, session, phone);
      break;

    case 'awaiting_time':
      await handleTimeChoice(text, session, phone);
      break;

    case 'awaiting_confirm':
      await handleConfirm(text, session, phone);
      break;

    default:
      await updateSession(session.id, 'awaiting_menu', {});
      await sendAndLog(phone, menuMessage(), session.id);
  }
}

// ============================================================================
// ESTADOS
// ============================================================================

function menuMessage(): string {
  return (
    `Olá! Sou o atendimento da Barbearia do Johnn ✂️\n\n` +
    `Como posso ajudar?\n\n` +
    `*1* - Agendar horário\n` +
    `*2* - Ver meus agendamentos\n` +
    `*3* - Falar com atendente\n\n` +
    `_Responda com o número da opção desejada._\n` +
    `_Digite "menu" a qualquer momento para voltar._`
  );
}

async function handleMenuChoice(
  text: string,
  session: SessionRow,
  phone: string
) {
  const admin = createAdminClient();

  if (text === '1') {
    // Lista servicos ativos
    const { data: services } = await admin
      .from('services')
      .select('id, name, base_price, base_duration_minutes')
      .eq('barbershop_id', BARBERSHOP_ID)
      .eq('active', true)
      .eq('show_on_public_menu', true)
      .order('display_order', { ascending: true })
      .limit(20);

    if (!services || services.length === 0) {
      await sendAndLog(
        phone,
        'Desculpe, não encontrei serviços disponíveis no momento. Digite "menu" para voltar.',
        session.id
      );
      return;
    }

    const list = services
      .map(
        (s, i) =>
          `*${i + 1}* - ${s.name} (R$ ${Number(s.base_price ?? 0).toFixed(2)} · ${s.base_duration_minutes ?? 30}min)`
      )
      .join('\n');

    const serviceMap = services.map((s) => ({
      id: s.id as string,
      name: s.name as string,
      duration: Number(s.base_duration_minutes ?? 30),
      price: Number(s.base_price ?? 0),
    }));

    await updateSession(session.id, 'awaiting_service', { services: serviceMap });
    await sendAndLog(
      phone,
      `Que serviço você gostaria de agendar? ✂️\n\n${list}\n\n_Digite o número da opção._`,
      session.id
    );
    return;
  }

  if (text === '2') {
    // Ver agendamentos do cliente
    const customer = await findCustomerByPhone(phone);
    if (!customer) {
      await sendAndLog(
        phone,
        'Não encontrei nenhum cadastro com esse número. Para agendar pela primeira vez, escolha a opção *1* no menu.',
        session.id
      );
      return;
    }

    const { data: apps } = await admin
      .from('appointments')
      .select('id, start_at, status')
      .eq('customer_id', customer.id)
      .gte('start_at', new Date().toISOString())
      .in('status', ['scheduled', 'in_progress'])
      .order('start_at', { ascending: true })
      .limit(5);

    if (!apps || apps.length === 0) {
      await sendAndLog(
        phone,
        'Você não tem agendamentos futuros. Digite *1* no menu para agendar.',
        session.id
      );
      return;
    }

    const list = apps
      .map((a) => {
        const d = new Date(a.start_at as string);
        return `📅 ${d.toLocaleString('pt-BR', {
          weekday: 'short',
          day: '2-digit',
          month: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        })} (${a.status})`;
      })
      .join('\n');

    await sendAndLog(
      phone,
      `Seus próximos agendamentos:\n\n${list}\n\nDigite "menu" para voltar.`,
      session.id
    );
    return;
  }

  if (text === '3') {
    await updateSession(session.id, 'idle', {});
    await sendAndLog(
      phone,
      'Beleza! Um atendente vai falar com você em instantes. ⏳\n\nSe preferir voltar ao menu automático, digite "menu".',
      session.id
    );
    return;
  }

  await sendAndLog(
    phone,
    'Não entendi. Por favor responda com *1*, *2* ou *3*.',
    session.id
  );
}

async function handleServiceChoice(
  text: string,
  session: SessionRow,
  phone: string
) {
  const services = (session.context?.services ?? []) as Array<{
    id: string;
    name: string;
    duration: number;
    price: number;
  }>;
  const idx = parseInt(text, 10) - 1;

  if (isNaN(idx) || idx < 0 || idx >= services.length) {
    await sendAndLog(
      phone,
      `Opção inválida. Responda com o número do serviço (1 a ${services.length}).`,
      session.id
    );
    return;
  }

  const chosen = services[idx];
  const dates = nextSevenDays();

  const dateList = dates
    .map((d, i) => {
      const label = d.toLocaleDateString('pt-BR', {
        weekday: 'long',
        day: '2-digit',
        month: '2-digit',
      });
      return `*${i + 1}* - ${label}`;
    })
    .join('\n');

  await updateSession(session.id, 'awaiting_date', {
    service: chosen,
    dates: dates.map((d) => d.toISOString()),
  });

  await sendAndLog(
    phone,
    `Ótima escolha: *${chosen.name}* 💈\n\nPara qual dia você quer agendar?\n\n${dateList}\n\n_Digite o número do dia._`,
    session.id
  );
}

async function handleDateChoice(
  text: string,
  session: SessionRow,
  phone: string
) {
  const dates = (session.context?.dates ?? []) as string[];
  const service = session.context?.service as {
    id: string;
    name: string;
    duration: number;
    price: number;
  };
  const idx = parseInt(text, 10) - 1;

  if (isNaN(idx) || idx < 0 || idx >= dates.length) {
    await sendAndLog(
      phone,
      `Opção inválida. Responda com o número do dia (1 a ${dates.length}).`,
      session.id
    );
    return;
  }

  const chosenDate = new Date(dates[idx]);

  // Busca horarios disponiveis: gera slots 09h-18h em intervalos de 30min
  // e filtra appointments ja existentes
  const admin = createAdminClient();

  const dayStart = new Date(chosenDate);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(chosenDate);
  dayEnd.setHours(23, 59, 59, 999);

  const { data: existing } = await admin
    .from('appointments')
    .select('start_at, end_at')
    .eq('barbershop_id', BARBERSHOP_ID)
    .in('status', ['scheduled', 'in_progress'])
    .gte('start_at', dayStart.toISOString())
    .lte('start_at', dayEnd.toISOString());

  const busy = (existing ?? []).map((a) => ({
    start: new Date(a.start_at as string).getTime(),
    end: new Date(a.end_at as string).getTime(),
  }));

  const slots: Date[] = [];
  for (let h = 9; h <= 18; h++) {
    for (let m = 0; m < 60; m += 30) {
      const slotStart = new Date(chosenDate);
      slotStart.setHours(h, m, 0, 0);

      // Ignora slots no passado
      if (slotStart.getTime() < Date.now()) continue;

      const slotEnd = new Date(slotStart.getTime() + service.duration * 60_000);

      // Verifica conflito
      const conflict = busy.some(
        (b) => slotStart.getTime() < b.end && slotEnd.getTime() > b.start
      );
      if (!conflict) slots.push(slotStart);
    }
  }

  if (slots.length === 0) {
    await sendAndLog(
      phone,
      'Nenhum horário disponível nesse dia. Digite *menu* para escolher outro dia.',
      session.id
    );
    return;
  }

  // Limita a 10 slots pra nao poluir
  const limited = slots.slice(0, 10);
  const slotList = limited
    .map(
      (s, i) =>
        `*${i + 1}* - ${s.toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
        })}`
    )
    .join('\n');

  await updateSession(session.id, 'awaiting_time', {
    service,
    chosenDate: chosenDate.toISOString(),
    slots: limited.map((s) => s.toISOString()),
  });

  await sendAndLog(
    phone,
    `Horários disponíveis em *${chosenDate.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' })}*:\n\n${slotList}\n\n_Digite o número do horário._`,
    session.id
  );
}

async function handleTimeChoice(
  text: string,
  session: SessionRow,
  phone: string
) {
  const slots = (session.context?.slots ?? []) as string[];
  const service = session.context?.service as {
    id: string;
    name: string;
    duration: number;
    price: number;
  };
  const idx = parseInt(text, 10) - 1;

  if (isNaN(idx) || idx < 0 || idx >= slots.length) {
    await sendAndLog(
      phone,
      `Opção inválida. Responda com o número do horário (1 a ${slots.length}).`,
      session.id
    );
    return;
  }

  const startAt = new Date(slots[idx]);

  await updateSession(session.id, 'awaiting_confirm', {
    service,
    startAt: startAt.toISOString(),
  });

  const dateStr = startAt.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  });
  const timeStr = startAt.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  await sendAndLog(
    phone,
    `Confirma o agendamento? 🪒\n\n💈 *${service.name}*\n💰 R$ ${service.price.toFixed(2)}\n📅 ${dateStr}\n🕐 ${timeStr}\n\n*1* - Sim, confirmar\n*2* - Não, cancelar`,
    session.id
  );
}

async function handleConfirm(
  text: string,
  session: SessionRow,
  phone: string
) {
  if (text === '2' || text === 'nao' || text === 'não') {
    await updateSession(session.id, 'awaiting_menu', {});
    await sendAndLog(
      phone,
      'Agendamento cancelado. Sem problemas! 👍\n\n' + menuMessage(),
      session.id
    );
    return;
  }

  if (text !== '1' && text !== 'sim') {
    await sendAndLog(
      phone,
      'Responda com *1* para confirmar ou *2* para cancelar.',
      session.id
    );
    return;
  }

  const admin = createAdminClient();
  const service = session.context?.service as {
    id: string;
    name: string;
    duration: number;
    price: number;
  };
  const startAt = new Date(session.context?.startAt as string);
  const endAt = new Date(startAt.getTime() + service.duration * 60_000);

  // Identifica cliente (ou cria stub)
  let customer = await findCustomerByPhone(phone);
  if (!customer) {
    const { data: created, error } = await admin
      .from('customers')
      .insert({
        barbershop_id: BARBERSHOP_ID,
        full_name: `Cliente WhatsApp ${phone.slice(-4)}`,
        phone,
        source: 'whatsapp',
      })
      .select('id, full_name')
      .single();

    if (error || !created) {
      await sendAndLog(
        phone,
        'Tivemos um problema ao criar seu cadastro. Pode tentar de novo digitando "menu"?',
        session.id
      );
      return;
    }
    customer = { id: created.id as string, full_name: created.full_name as string };

    // Vincula customer_id a sessao
    await admin
      .from('whatsapp_sessions')
      .update({ customer_id: customer.id })
      .eq('id', session.id);
  }

  // Pega um staff disponivel (primeiro ativo)
  const { data: staff } = await admin
    .from('staff')
    .select('id, default_commission_percent, display_name')
    .eq('barbershop_id', BARBERSHOP_ID)
    .eq('active', true)
    .order('display_order', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!staff) {
    await sendAndLog(
      phone,
      'Nenhum profissional disponível no momento. Tente mais tarde ou digite *3* no menu.',
      session.id
    );
    return;
  }

  // Cria appointment
  const { data: app, error: errApp } = await admin
    .from('appointments')
    .insert({
      barbershop_id: BARBERSHOP_ID,
      customer_id: customer.id,
      staff_id: staff.id,
      start_at: startAt.toISOString(),
      end_at: endAt.toISOString(),
      status: 'scheduled',
      source: 'whatsapp',
    })
    .select('id')
    .single();

  if (errApp || !app) {
    await sendAndLog(
      phone,
      'Não consegui registrar seu agendamento. Pode digitar "menu" e tentar de novo?',
      session.id
    );
    return;
  }

  // Cria appointment_service
  await admin.from('appointment_services').insert({
    barbershop_id: BARBERSHOP_ID,
    appointment_id: app.id,
    service_id: service.id,
    price: service.price,
    duration_minutes: service.duration,
    commission_percent: Number(staff.default_commission_percent ?? 0),
  });

  // Mensagem final de confirmacao
  const { data: bs } = await admin
    .from('barbershops')
    .select('name')
    .eq('id', BARBERSHOP_ID)
    .maybeSingle();

  const confirmMsg = confirmationTemplate({
    customerName: customer.full_name.split(' ')[0],
    serviceName: service.name,
    dateTime: startAt,
    barbershopName: (bs?.name as string) ?? 'Barbearia',
    staffName: (staff.display_name as string) ?? undefined,
  });

  await updateSession(session.id, 'idle', {});
  await sendAndLog(phone, confirmMsg, session.id);
}

// ============================================================================
// HELPERS
// ============================================================================

interface SessionRow {
  id: string;
  state: string;
  customer_id: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  context: Record<string, any>;
}

async function getOrCreateSession(phone: string): Promise<SessionRow> {
  const admin = createAdminClient();
  const { data: existing } = await admin
    .from('whatsapp_sessions')
    .select('id, state, customer_id, context')
    .eq('barbershop_id', BARBERSHOP_ID)
    .eq('phone', phone)
    .maybeSingle();

  if (existing) {
    return {
      id: existing.id as string,
      state: (existing.state as string) ?? 'idle',
      customer_id: (existing.customer_id as string) ?? null,
      context: (existing.context ?? {}) as Record<string, unknown>,
    };
  }

  // Cria nova sessao tentando vincular customer se ja existir
  const customer = await findCustomerByPhone(phone);

  const { data: created } = await admin
    .from('whatsapp_sessions')
    .insert({
      barbershop_id: BARBERSHOP_ID,
      phone,
      customer_id: customer?.id ?? null,
      state: 'idle',
      context: {},
    })
    .select('id, state, customer_id, context')
    .single();

  return {
    id: created!.id as string,
    state: (created!.state as string) ?? 'idle',
    customer_id: (created!.customer_id as string) ?? null,
    context: (created!.context ?? {}) as Record<string, unknown>,
  };
}

async function updateSession(
  sessionId: string,
  state: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  context: Record<string, any>
) {
  const admin = createAdminClient();
  await admin
    .from('whatsapp_sessions')
    .update({
      state,
      context,
      last_message_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', sessionId);
}

async function sendAndLog(phone: string, body: string, sessionId: string) {
  const admin = createAdminClient();
  const result = await sendWhatsAppMessage(phone, body);
  await admin.from('whatsapp_messages').insert({
    barbershop_id: BARBERSHOP_ID,
    session_id: sessionId,
    direction: 'out',
    phone,
    body,
    meta_message_id: result.messageId ?? null,
    status: result.ok ? 'sent' : 'failed',
  });
}

async function findCustomerByPhone(
  phone: string
): Promise<{ id: string; full_name: string } | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from('customers')
    .select('id, full_name')
    .eq('barbershop_id', BARBERSHOP_ID)
    .eq('phone', phone)
    .maybeSingle();

  if (!data) return null;
  return { id: data.id as string, full_name: data.full_name as string };
}

function nextSevenDays(): Date[] {
  const out: Date[] = [];
  const now = new Date();
  for (let i = 0; i < 7; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    d.setHours(0, 0, 0, 0);
    out.push(d);
  }
  return out;
}
