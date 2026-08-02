'use server';

import { createManagerClient } from '@/lib/supabase/manager';
import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';
import { notifyCustomer } from '@/lib/notifications';
import { avisoDeHorarioMarcado, avisoDeHorarioDesmarcado } from '@/lib/avisos';
import { lojaAtual } from '@/lib/loja';
import {
  avisarClienteQueMarcamos,
  avisarClienteQueDesmarcamos,
} from '@/lib/avisos-da-agenda';
import {
  sendWhatsAppMessage,
  confirmationTemplate,
} from '@/lib/whatsapp';

export interface AppointmentData {
  customer_id: string;
  staff_id: string;
  start_at: string; // ISO timestamp
  end_at: string; // ISO timestamp
  service_id?: string | null;
  notes?: string | null;
  status?: string;
  source?: string;
  /** Liga os atendimentos de quem chegou junto e vai ser atendido junto */
  group_id?: string | null;
}

/**
 * Traduz erros do banco em mensagens amigaveis para o usuario.
 * O conflito de horario vem da exclusion constraint (codigo 23P01).
 */
function friendlyAppointmentError(error: {
  code?: string;
  message?: string;
}): string {
  const code = error?.code;
  const msg = error?.message ?? '';
  if (code === '23P01' || /overlap|no_overlapping/i.test(msg)) {
    return 'Esse profissional já tem um agendamento nesse horário. Escolha outro horário ou profissional.';
  }
  if (code === '23505') {
    return 'Já existe um agendamento idêntico nesse horário.';
  }
  console.error('[createAppointment] erro nao mapeado:', error);
  return 'Não foi possível criar o agendamento. Tente novamente.';
}

/**
 * Cria um agendamento.
 * - appointments NÃO tem service_id direto (foi movido para appointment_services)
 * - status default é 'scheduled' (enum appointment_status)
 * - Se service_id for fornecido, cria também a entrada em appointment_services
 */
export async function createAppointment(data: AppointmentData) {
  const admin = await createManagerClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payload: any = {
    barbershop_id: (await lojaAtual()),
    customer_id: data.customer_id,
    staff_id: data.staff_id,
    start_at: data.start_at,
    end_at: data.end_at,
    status: data.status ?? 'scheduled',
    source: data.source ?? 'manual',
  };

  if (data.notes) payload.notes = data.notes;
  if (data.group_id) payload.group_id = data.group_id;

  const { data: created, error } = await admin
    .from('appointments')
    .insert(payload)
    .select()
    .single();

  if (error) return { ok: false, error: friendlyAppointmentError(error) };

  // Se um serviço foi escolhido, criar entrada em appointment_services
  if (data.service_id) {
    // Buscar preço, duração e commission_percent do staff
    const [{ data: service }, { data: staff }] = await Promise.all([
      admin
        .from('services')
        .select('base_price, base_duration_minutes')
        .eq('id', data.service_id)
        .maybeSingle(),
      admin
        .from('staff')
        .select('default_commission_percent')
        .eq('id', data.staff_id)
        .maybeSingle(),
    ]);

    if (service) {
      const start = new Date(data.start_at).getTime();
      const end = new Date(data.end_at).getTime();
      const durationMinutes =
        Math.round((end - start) / 60000) ||
        Number(service.base_duration_minutes ?? 30);

      await admin.from('appointment_services').insert({
        barbershop_id: (await lojaAtual()),
        appointment_id: created.id,
        service_id: data.service_id,
        price: Number(service.base_price ?? 0),
        duration_minutes: durationMinutes,
        commission_percent: Number(staff?.default_commission_percent ?? 0),
      });
    }
  }

  // O cliente precisa saber do horario que marcaram para ele. Sem este aviso,
  // ele so descobre se alguem lembrar de mandar mensagem na mao, e horario que
  // aparece do nada na agenda de alguem vira falta no dia.
  await avisarClienteDoHorario({
    customerId: data.customer_id,
    staffId: data.staff_id,
    serviceId: data.service_id ?? null,
    appointmentId: created.id as string,
    startAt: data.start_at,
  });

  revalidatePath('/admin/agenda');
  revalidatePath('/admin');
  return { ok: true, appointment: created };
}

/**
 * Avisa o cliente de um horario que a barbearia marcou para ele.
 *
 * Best effort de proposito: aviso que falha nao pode derrubar o agendamento
 * que ja foi gravado. Pior que nao avisar e a recepcao ver erro na tela e
 * marcar de novo, criando dois horarios para a mesma pessoa.
 */
async function avisarClienteDoHorario(opts: {
  customerId: string;
  staffId: string;
  serviceId: string | null;
  appointmentId: string;
  startAt: string;
}) {
  try {
    const admin = createAdminClient();
    const [{ data: staff }, { data: service }] = await Promise.all([
      admin.from('staff').select('display_name').eq('id', opts.staffId).maybeSingle(),
      opts.serviceId
        ? admin.from('services').select('name').eq('id', opts.serviceId).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    const texto = avisoDeHorarioMarcado({
      servico: (service?.name as string) ?? null,
      profissional: (staff?.display_name as string) ?? null,
      quandoISO: opts.startAt,
    });

    await notifyCustomer({
      customerId: opts.customerId,
      type: 'agendamento_confirmado',
      title: texto.titulo,
      body: texto.corpo,
      metadata: { appointment_id: opts.appointmentId },
      // O WhatsApp da barbearia fica com uma pessoa de verdade
      whatsapp: false,
    });

    // E toca no celular dele, para nao depender de abrir o aplicativo
    await avisarClienteQueMarcamos({
      customerId: opts.customerId,
      quandoISO: opts.startAt,
      servico: (service?.name as string) ?? null,
      profissional: (staff?.display_name as string) ?? null,
    });
  } catch {
    // Silencio: o agendamento vale mais que o aviso
  }
}

/**
 * Marca duas ou mais pessoas para o mesmo horario, cada uma com o seu barbeiro.
 *
 * E o caso do pai que traz o filho, dos dois amigos que chegam juntos e da
 * turma antes do casamento: ninguem quer ficar esperando o outro terminar.
 * Antes era preciso lancar um por um e torcer para nao dar conflito no meio.
 *
 * Ou entra o grupo inteiro, ou nao entra ninguem: metade do grupo marcado e
 * pior do que nenhum, porque alguem chega e descobre na hora que ficou de fora.
 */
export async function createGroupAppointment(dados: {
  start_at: string;
  end_at: string;
  notes?: string | null;
  pessoas: Array<{
    customer_id: string;
    staff_id: string;
    service_id?: string | null;
  }>;
}) {
  if (dados.pessoas.length < 2) {
    return { ok: false, error: 'Um grupo precisa de pelo menos duas pessoas.' };
  }

  const semProfissional = dados.pessoas.some((p) => !p.customer_id || !p.staff_id);
  if (semProfissional) {
    return { ok: false, error: 'Escolha o cliente e o profissional de cada pessoa.' };
  }

  // Duas pessoas do grupo com o mesmo barbeiro no mesmo horario e impossivel, e
  // o banco recusaria a segunda. Melhor avisar antes com uma frase que explica.
  const barbeiros = dados.pessoas.map((p) => p.staff_id);
  if (new Set(barbeiros).size !== barbeiros.length) {
    return {
      ok: false,
      error: 'Cada pessoa do grupo precisa de um profissional diferente, senão não dá para atender ao mesmo tempo.',
    };
  }

  const grupoId = crypto.randomUUID();
  const criados: string[] = [];

  for (const pessoa of dados.pessoas) {
    const res = await createAppointment({
      customer_id: pessoa.customer_id,
      staff_id: pessoa.staff_id,
      service_id: pessoa.service_id ?? null,
      start_at: dados.start_at,
      end_at: dados.end_at,
      notes: dados.notes ?? null,
      group_id: grupoId,
    });

    if (!res.ok || !res.appointment) {
      // Desfaz o que ja entrou: grupo pela metade nao serve para ninguem
      const admin = await createManagerClient();
      for (const id of criados) {
        await admin.from('appointment_services').delete().eq('appointment_id', id);
        await admin.from('appointments').delete().eq('id', id);
      }
      return { ok: false, error: res.error ?? 'Não foi possível marcar o grupo.' };
    }

    criados.push(res.appointment.id as string);
  }

  revalidatePath('/admin/agenda');
  revalidatePath('/admin');
  return { ok: true, grupoId, quantidade: criados.length };
}

/**
 * Atualiza status do agendamento (confirmar, cancelar, completar, etc.).
 * Enum appointment_status: scheduled | in_progress | completed | cancelled | no_show
 */
export async function updateAppointmentStatus(
  id: string,
  status:
    | 'scheduled'
    | 'confirmed'
    | 'in_progress'
    | 'completed'
    | 'cancelled'
    | 'no_show'
) {
  const admin = await createManagerClient();

  const { error } = await admin
    .from('appointments')
    .update({ status })
    .eq('id', id);

  if (error) return { ok: false, error: error.message };

  if (status === 'cancelled') await avisarClienteDoCancelamento(id);

  revalidatePath('/admin/agenda');
  revalidatePath('/admin');
  return { ok: true };
}

/**
 * Avisa o cliente que a barbearia desmarcou o horario dele.
 *
 * Cancelamento sem aviso e o pior dos dois lados: o cliente aparece na porta e
 * a cadeira esta ocupada, ou ele nao aparece nunca mais.
 */
async function avisarClienteDoCancelamento(appointmentId: string) {
  try {
    const admin = createAdminClient();
    const { data: agendamento } = await admin
      .from('appointments')
      .select('customer_id, start_at, cancellation_reason')
      .eq('id', appointmentId)
      .maybeSingle();

    if (!agendamento?.customer_id) return;

    const texto = avisoDeHorarioDesmarcado({
      quandoISO: agendamento.start_at as string,
      motivo: (agendamento.cancellation_reason as string) ?? null,
    });

    await notifyCustomer({
      customerId: agendamento.customer_id as string,
      type: 'agendamento_cancelado',
      title: texto.titulo,
      body: texto.corpo,
      metadata: { appointment_id: appointmentId },
      whatsapp: false,
    });

    await avisarClienteQueDesmarcamos({
      customerId: agendamento.customer_id as string,
      quandoISO: agendamento.start_at as string,
    });
  } catch {
    // Silencio: o cancelamento ja esta gravado
  }
}

/**
 * Atualiza dados do agendamento.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function updateAppointment(id: string, data: any) {
  const admin = await createManagerClient();

  // Remove service_id do payload se vier (deve ser tratado via appointment_services)
  const { service_id: _ignoredServiceId, ...rest } = data;

  const { error } = await admin
    .from('appointments')
    .update(rest)
    .eq('id', id);

  if (error) return { ok: false, error: error.message };

  revalidatePath('/admin/agenda');
  return { ok: true };
}

/**
 * Deleta agendamento (e seus appointment_services via cascade do FK).
 */
export async function deleteAppointment(id: string) {
  const admin = await createManagerClient();

  // Avisa antes de apagar: depois nao ha mais de onde tirar a data nem o cliente
  await avisarClienteDoCancelamento(id);

  // Tenta deletar appointment_services manualmente caso não tenha cascade
  await admin.from('appointment_services').delete().eq('appointment_id', id);

  const { error } = await admin.from('appointments').delete().eq('id', id);

  if (error) return { ok: false, error: error.message };

  revalidatePath('/admin/agenda');
  return { ok: true };
}
