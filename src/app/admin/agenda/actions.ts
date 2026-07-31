'use server';

import { createManagerClient } from '@/lib/supabase/manager';
import { revalidatePath } from 'next/cache';
import {
  sendWhatsAppMessage,
  confirmationTemplate,
} from '@/lib/whatsapp';

const BARBERSHOP_ID = '11111111-1111-1111-1111-111111111111';

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
    barbershop_id: BARBERSHOP_ID,
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
        barbershop_id: BARBERSHOP_ID,
        appointment_id: created.id,
        service_id: data.service_id,
        price: Number(service.base_price ?? 0),
        duration_minutes: durationMinutes,
        commission_percent: Number(staff?.default_commission_percent ?? 0),
      });
    }
  }

  revalidatePath('/admin/agenda');
  revalidatePath('/admin');
  return { ok: true, appointment: created };
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

  revalidatePath('/admin/agenda');
  revalidatePath('/admin');
  return { ok: true };
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

  // Tenta deletar appointment_services manualmente caso não tenha cascade
  await admin.from('appointment_services').delete().eq('appointment_id', id);

  const { error } = await admin.from('appointments').delete().eq('id', id);

  if (error) return { ok: false, error: error.message };

  revalidatePath('/admin/agenda');
  return { ok: true };
}
