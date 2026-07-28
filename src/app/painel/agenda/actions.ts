'use server';

/**
 * Acoes da agenda do barbeiro.
 *
 * Todas seguem o mesmo rito: exigir o modulo, conferir que o registro e dele
 * (pelo staff_id da sessao, nunca por parametro) e so entao gravar. Sao acoes
 * proprias, curtas, de proposito: reaproveitar as do admin traria junto a
 * suposicao de poder total que elas carregam.
 */

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { exigirModulo } from '@/lib/staff-auth';
import { BARBERSHOP_ID } from '@/lib/painel/dados';
import {
  avaliarAcao,
  type AcaoAgenda,
  type StatusAgendamento,
} from '@/lib/painel/agenda-estados';

export async function mudarStatusAgendamento(
  appointmentId: string,
  acao: AcaoAgenda
) {
  const acesso = await exigirModulo('agenda_operar');
  if (!acesso.ok) return { ok: false, error: acesso.error };

  const admin = createAdminClient();

  // Guarda de dono: o agendamento tem que ser do profissional da sessao
  const { data: agendamento } = await admin
    .from('appointments')
    .select('id, status, start_at, staff_id')
    .eq('id', appointmentId)
    .eq('staff_id', acesso.staff.staffId)
    .maybeSingle();

  if (!agendamento) {
    return { ok: false, error: 'Este atendimento não é seu.' };
  }

  const avaliacao = avaliarAcao(
    agendamento.status as StatusAgendamento,
    acao,
    new Date(agendamento.start_at as string)
  );

  // Também cobre o clique duplo em rede ruim: a segunda chamada chega com o
  // status já alterado e para aqui, sem gravar de novo.
  if (!avaliacao.ok || !avaliacao.proximo) {
    return { ok: false, error: avaliacao.motivo ?? 'Ação não permitida agora.' };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payload: any = { status: avaliacao.proximo };
  if (avaliacao.proximo === 'completed') {
    payload.completed_at = new Date().toISOString();
  }

  const { error } = await admin
    .from('appointments')
    .update(payload)
    .eq('id', appointmentId)
    .eq('staff_id', acesso.staff.staffId);

  if (error) return { ok: false, error: error.message };

  revalidatePath('/painel');
  revalidatePath('/painel/agenda');
  return { ok: true };
}

/**
 * Bloqueia um dia inteiro da agenda dele.
 *
 * O modelo do sistema trabalha com folga por dia (days_off), nao por faixa de
 * horario, entao o painel bloqueia o dia e a tela diz isso com todas as
 * letras. O bloqueio nunca sai do staff_id da sessao, entao ninguem consegue
 * bloquear a agenda da barbearia nem a de um colega.
 */
export async function bloquearMeuDia(dataStr: string, motivo: string) {
  const acesso = await exigirModulo('agenda_operar');
  if (!acesso.ok) return { ok: false, error: acesso.error };

  const hoje = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
  }).format(new Date());

  if (dataStr < hoje) {
    return { ok: false, error: 'Não dá para bloquear um dia que já passou.' };
  }

  const admin = createAdminClient();

  // Dia com atendimento marcado precisa ser resolvido antes
  const { count } = await admin
    .from('appointments')
    .select('id', { count: 'exact', head: true })
    .eq('staff_id', acesso.staff.staffId)
    .in('status', ['scheduled', 'confirmed', 'in_progress'])
    .gte('start_at', `${dataStr}T00:00:00.000-03:00`)
    .lte('start_at', `${dataStr}T23:59:59.999-03:00`);

  if ((count ?? 0) > 0) {
    return {
      ok: false,
      error: `Você tem ${count} atendimento(s) marcado(s) nesse dia. Fale com a gestão para remarcar antes de bloquear.`,
    };
  }

  const { error } = await admin.from('days_off').insert({
    barbershop_id: BARBERSHOP_ID,
    staff_id: acesso.staff.staffId,
    start_date: dataStr,
    end_date: dataStr,
    type: 'day_off',
    reason: motivo || 'Bloqueado pelo profissional',
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath('/painel/agenda');
  return { ok: true };
}

/** Busca cliente para o encaixe. Devolve o minimo necessario. */
export async function buscarClienteParaEncaixe(termo: string) {
  const acesso = await exigirModulo('agenda_operar');
  if (!acesso.ok) return { ok: false as const, error: acesso.error };

  const busca = termo.trim();
  if (busca.length < 3) {
    return { ok: true as const, clientes: [] };
  }

  const admin = createAdminClient();
  const like = `%${busca}%`;

  const { data } = await admin
    .from('customers')
    .select('id, full_name, phone')
    .eq('barbershop_id', BARBERSHOP_ID)
    .eq('active', true)
    .or(`full_name.ilike.${like},phone.ilike.${like}`)
    .order('full_name')
    .limit(8);

  return { ok: true as const, clientes: data ?? [] };
}

export async function servicosDisponiveis() {
  const acesso = await exigirModulo('agenda_operar');
  if (!acesso.ok) return { ok: false as const, error: acesso.error };

  const admin = createAdminClient();
  const { data } = await admin
    .from('services')
    .select('id, name, base_price, base_duration_minutes')
    .eq('barbershop_id', BARBERSHOP_ID)
    .eq('active', true)
    .order('name');

  return { ok: true as const, servicos: data ?? [] };
}

/**
 * Encaixa um cliente na propria agenda.
 * O staff_id sai da sessao, entao ninguem encaixa na agenda de outro.
 */
export async function encaixarCliente(dados: {
  customerId: string;
  serviceId: string;
  inicioIso: string;
  observacao?: string;
}) {
  const acesso = await exigirModulo('agenda_operar');
  if (!acesso.ok) return { ok: false, error: acesso.error };

  const admin = createAdminClient();

  const { data: servico } = await admin
    .from('services')
    .select('base_price, base_duration_minutes')
    .eq('id', dados.serviceId)
    .maybeSingle();

  if (!servico) return { ok: false, error: 'Serviço não encontrado.' };

  const duracao = Number(servico.base_duration_minutes ?? 30);
  const inicio = new Date(dados.inicioIso);
  const fim = new Date(inicio.getTime() + duracao * 60000);

  const { data: criado, error } = await admin
    .from('appointments')
    .insert({
      barbershop_id: BARBERSHOP_ID,
      customer_id: dados.customerId,
      staff_id: acesso.staff.staffId,
      start_at: inicio.toISOString(),
      end_at: fim.toISOString(),
      status: 'confirmed',
      source: 'painel_barbeiro',
      notes: dados.observacao || null,
    })
    .select('id')
    .single();

  if (error) {
    // A trava de sobreposicao do banco vira aviso em portugues
    if (error.code === '23P01' || /overlap/i.test(error.message)) {
      return { ok: false, error: 'Você já tem atendimento nesse horário.' };
    }
    return { ok: false, error: error.message };
  }

  await admin.from('appointment_services').insert({
    barbershop_id: BARBERSHOP_ID,
    appointment_id: criado.id,
    service_id: dados.serviceId,
    price: Number(servico.base_price ?? 0),
    duration_minutes: duracao,
    commission_percent: acesso.staff.commissionPercent,
  });

  revalidatePath('/painel');
  revalidatePath('/painel/agenda');
  return { ok: true };
}
