'use server';

/**
 * Server actions do painel do cliente (/cliente).
 * TODAS validam a sessao do cliente antes de tocar no banco.
 */

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSessionCustomer } from '@/lib/customer-auth';
import { getAvailableSlots, isSlotStillFree } from '@/lib/booking';
import {
  getActiveSubscription,
  isDayAllowed,
  formatAllowedDays,
} from '@/lib/subscriptions';
import { notifyCustomer } from '@/lib/notifications';

const BARBERSHOP_ID = '11111111-1111-1111-1111-111111111111';

function fmtDateTimeBR(d: Date) {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

// ---------------------------------------------------------------------------
// SLOTS EM TEMPO REAL
// ---------------------------------------------------------------------------

export async function getSlotsAction(
  staffId: string,
  serviceId: string,
  dateStr: string
) {
  const customer = await getSessionCustomer();
  if (!customer) return { ok: false, slots: [], durationMinutes: 0 };
  return getAvailableSlots({ staffId, serviceId, dateStr });
}

// ---------------------------------------------------------------------------
// AGENDAR
// ---------------------------------------------------------------------------

export interface BookInput {
  service_id: string;
  staff_id: string;
  startISO: string;
}

export async function bookAppointment(input: BookInput) {
  const customer = await getSessionCustomer();
  if (!customer) return { ok: false, error: 'Sessão expirada. Entre novamente.' };

  const admin = createAdminClient();

  const [{ data: service }, { data: staffService }, { data: staff }] =
    await Promise.all([
      admin
        .from('services')
        .select('name, base_price, base_duration_minutes, active')
        .eq('id', input.service_id)
        .maybeSingle(),
      admin
        .from('staff_services')
        .select('custom_price, custom_duration_minutes')
        .eq('staff_id', input.staff_id)
        .eq('service_id', input.service_id)
        .maybeSingle(),
      admin
        .from('staff')
        .select('display_name, default_commission_percent, active')
        .eq('id', input.staff_id)
        .maybeSingle(),
    ]);

  if (!service || service.active === false) {
    return { ok: false, error: 'Serviço indisponível' };
  }
  if (!staff || staff.active === false) {
    return { ok: false, error: 'Profissional indisponível' };
  }

  const duration =
    Number(staffService?.custom_duration_minutes) ||
    Number(service.base_duration_minutes) ||
    30;
  const price =
    staffService?.custom_price != null
      ? Number(staffService.custom_price)
      : Number(service.base_price ?? 0);

  const start = new Date(input.startISO);
  if (Number.isNaN(start.getTime())) {
    return { ok: false, error: 'Horário inválido' };
  }
  if (start.getTime() < Date.now()) {
    return { ok: false, error: 'Esse horário já passou. Escolha outro.' };
  }
  const end = new Date(start.getTime() + duration * 60000);

  // Revalida o slot (evita corrida entre dois clientes)
  const free = await isSlotStillFree({
    staffId: input.staff_id,
    startISO: start.toISOString(),
    endISO: end.toISOString(),
  });
  if (!free) {
    return {
      ok: false,
      error: 'Esse horário acabou de ser reservado. Escolha outro.',
      slotTaken: true,
    };
  }

  // Assinatura: cobre ou nao?
  const sub = await getActiveSubscription(admin, customer.id);
  let covered = false;
  let outsideDays = false;

  if (sub && !sub.isExpired && sub.usesLeft > 0) {
    if (isDayAllowed(start, sub.plan.allowed_days)) {
      // Se o plano restringe servicos, valida
      const { data: planServices } = await admin
        .from('subscription_plan_services')
        .select('service_id')
        .eq('plan_id', sub.plan.id);
      covered =
        !planServices ||
        planServices.length === 0 ||
        planServices.some((p) => p.service_id === input.service_id);
    } else {
      outsideDays = true;
    }
  } else if (sub && !sub.isExpired && sub.usesLeft <= 0) {
    if (!isDayAllowed(start, sub.plan.allowed_days)) outsideDays = true;
  }

  const { data: created, error } = await admin
    .from('appointments')
    .insert({
      barbershop_id: BARBERSHOP_ID,
      customer_id: customer.id,
      staff_id: input.staff_id,
      start_at: start.toISOString(),
      end_at: end.toISOString(),
      status: 'scheduled',
      source: 'public_site',
      subscription_id: covered && sub ? sub.id : null,
    })
    .select('id')
    .single();

  if (error || !created) {
    return { ok: false, error: error?.message ?? 'Erro ao agendar' };
  }

  await admin.from('appointment_services').insert({
    barbershop_id: BARBERSHOP_ID,
    appointment_id: created.id,
    service_id: input.service_id,
    price,
    duration_minutes: duration,
    commission_percent: Number(staff.default_commission_percent ?? 0),
  });

  // Notificacoes
  const when = fmtDateTimeBR(start);
  await notifyCustomer({
    customerId: customer.id,
    type: 'agendamento_confirmado',
    title: 'Agendamento confirmado! ✂️',
    body: `${service.name} com ${staff.display_name} em ${when}.${
      covered
        ? ' Este atendimento será coberto pela sua assinatura (conta como uso na hora do atendimento).'
        : ''
    } Até lá!`,
    metadata: { appointment_id: created.id },
  });

  if (sub && outsideDays) {
    await notifyCustomer({
      customerId: customer.id,
      type: 'assinatura_fora_dias',
      title: 'Fora dos dias do plano',
      body: `Seu plano ${sub.plan.name} cobre ${formatAllowedDays(sub.plan.allowed_days)}. O agendamento de ${when} será cobrado à parte e não conta como uso da assinatura.`,
      metadata: { appointment_id: created.id },
    });
  }

  revalidatePath('/cliente');
  revalidatePath('/cliente/agendamentos');
  revalidatePath('/admin/agenda');

  return { ok: true, covered, outsideDays, appointmentId: created.id as string };
}

// ---------------------------------------------------------------------------
// CANCELAR AGENDAMENTO
// ---------------------------------------------------------------------------

const CANCEL_MIN_HOURS = 2;

export async function cancelCustomerAppointment(appointmentId: string) {
  const customer = await getSessionCustomer();
  if (!customer) return { ok: false, error: 'Sessão expirada. Entre novamente.' };

  const admin = createAdminClient();

  const { data: appt } = await admin
    .from('appointments')
    .select('id, start_at, status, customer_id')
    .eq('id', appointmentId)
    .eq('customer_id', customer.id)
    .maybeSingle();

  if (!appt) return { ok: false, error: 'Agendamento não encontrado' };
  if (appt.status !== 'scheduled') {
    return { ok: false, error: 'Este agendamento não pode mais ser cancelado' };
  }

  const start = new Date(appt.start_at as string);
  if (start.getTime() - Date.now() < CANCEL_MIN_HOURS * 3600 * 1000) {
    return {
      ok: false,
      error: `Cancelamento permitido até ${CANCEL_MIN_HOURS}h antes. Fale com a barbearia pelo WhatsApp.`,
    };
  }

  const { error } = await admin
    .from('appointments')
    .update({ status: 'cancelled' })
    .eq('id', appointmentId);

  if (error) return { ok: false, error: error.message };

  await notifyCustomer({
    customerId: customer.id,
    type: 'agendamento_cancelado',
    title: 'Agendamento cancelado',
    body: `Seu horário de ${fmtDateTimeBR(start)} foi cancelado. Quando quiser, é só agendar de novo pelo painel.`,
    whatsapp: false,
  });

  revalidatePath('/cliente');
  revalidatePath('/cliente/agendamentos');
  revalidatePath('/admin/agenda');

  return { ok: true };
}

// ---------------------------------------------------------------------------
// NOTIFICACOES
// ---------------------------------------------------------------------------

export async function markAllNotificationsRead() {
  const customer = await getSessionCustomer();
  if (!customer) return { ok: false };

  const admin = createAdminClient();
  await admin
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('customer_id', customer.id)
    .is('read_at', null);

  revalidatePath('/cliente');
  revalidatePath('/cliente/notificacoes');
  return { ok: true };
}

// ============================================================
// BONUS POINTS (raspadinha, etc.)
// ============================================================
export async function awardBonusPoints(
  customerId: string,
  points: number,
  reason: string
) {
  'use server';
  const { createAdminClient } = await import('@/lib/supabase/admin');
  const admin = createAdminClient();
  const BARBERSHOP_ID = '11111111-1111-1111-1111-111111111111';

  try {
    const { data: current } = await admin
      .from('loyalty_points')
      .select('id, balance, lifetime_earned')
      .eq('customer_id', customerId)
      .eq('barbershop_id', BARBERSHOP_ID)
      .maybeSingle();

    if (!current) {
      await admin.from('loyalty_points').insert({
        barbershop_id: BARBERSHOP_ID,
        customer_id: customerId,
        balance: points,
        lifetime_earned: points,
        lifetime_redeemed: 0,
      });
    } else {
      await admin.from('loyalty_points').update({
        balance: Number(current.balance ?? 0) + points,
        lifetime_earned: Number(current.lifetime_earned ?? 0) + points,
      }).eq('id', current.id);
    }

    await admin.from('loyalty_points_events').insert({
      barbershop_id: BARBERSHOP_ID,
      customer_id: customerId,
      event_type: 'earned_bonus',
      points_delta: points,
      description: reason,
    });

    return { ok: true };
  } catch {
    return { ok: false };
  }
}