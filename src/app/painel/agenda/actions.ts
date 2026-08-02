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
import { notifyCustomer } from '@/lib/notifications';
import { avisoDeHorarioMarcado, avisoDeHorarioDesmarcado } from '@/lib/avisos';
import {
  avisarClienteQueMarcamos,
  avisarClienteQueDesmarcamos,
} from '@/lib/avisos-da-agenda';

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
    .select('id, status, start_at, staff_id, customer_id')
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

  // A gravação exige que o status ainda seja o que foi lido acima. Duas abas
  // agindo ao mesmo tempo não podem escrever uma por cima da outra: a segunda
  // não encontra linha e recebe o aviso de que a agenda mudou.
  const { data: alterado, error } = await admin
    .from('appointments')
    .update(payload)
    .eq('id', appointmentId)
    .eq('staff_id', acesso.staff.staffId)
    .eq('status', agendamento.status)
    .select('id')
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!alterado) {
    return {
      ok: false,
      error: 'Este atendimento mudou enquanto você olhava. Atualize a agenda.',
    };
  }

  // Barbeiro desmarcou: quem fica sem horario e o cliente, e ele nao esta
  // olhando a tela. Aviso no aplicativo e no celular.
  if (avaliacao.proximo === 'cancelled' && agendamento.customer_id) {
    try {
      const texto = avisoDeHorarioDesmarcado({
        quandoISO: agendamento.start_at as string,
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
      // O cancelamento ja esta gravado
    }
  }

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

  // Cliente e serviço vêm da tela, então os dois são conferidos: precisam ser
  // desta barbearia e estar ativos.
  const [{ data: cliente }, { data: servico }] = await Promise.all([
    admin
      .from('customers')
      .select('id')
      .eq('id', dados.customerId)
      .eq('barbershop_id', BARBERSHOP_ID)
      .eq('active', true)
      .maybeSingle(),
    admin
      .from('services')
      .select('name, base_price, base_duration_minutes')
      .eq('id', dados.serviceId)
      .eq('barbershop_id', BARBERSHOP_ID)
      .eq('active', true)
      .maybeSingle(),
  ]);

  if (!cliente) return { ok: false, error: 'Cliente não encontrado.' };
  if (!servico) return { ok: false, error: 'Serviço não encontrado.' };

  const duracao = Number(servico.base_duration_minutes ?? 30);
  const inicio = new Date(dados.inicioIso);
  const fim = new Date(inicio.getTime() + duracao * 60000);

  if (Number.isNaN(inicio.getTime())) {
    return { ok: false, error: 'Horário inválido.' };
  }

  // Encaixe é para agora ou para frente. Uma folga de cinco minutos cobre o
  // caso real de lançar o encaixe logo depois de o cliente sentar na cadeira.
  if (inicio.getTime() < Date.now() - 5 * 60000) {
    return { ok: false, error: 'Não dá para encaixar em um horário que já passou.' };
  }

  // Dia bloqueado por ele mesmo não recebe encaixe
  const diaStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
  }).format(inicio);

  const { data: folga } = await admin
    .from('days_off')
    .select('id')
    .eq('staff_id', acesso.staff.staffId)
    .lte('start_date', diaStr)
    .gte('end_date', diaStr)
    .maybeSingle();

  if (folga) {
    return { ok: false, error: 'Esse dia está bloqueado na sua agenda.' };
  }

  const { data: criado, error } = await admin
    .from('appointments')
    .insert({
      barbershop_id: BARBERSHOP_ID,
      customer_id: dados.customerId,
      staff_id: acesso.staff.staffId,
      start_at: inicio.toISOString(),
      end_at: fim.toISOString(),
      status: 'confirmed',
      // O enum appointment_source nao tem valor proprio para o painel, e
      // encaixe e marcacao feita por gente da casa, igual ao que a recepcao faz
      source: 'manual',
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

  const { error: erroServico } = await admin.from('appointment_services').insert({
    barbershop_id: BARBERSHOP_ID,
    appointment_id: criado.id,
    service_id: dados.serviceId,
    price: Number(servico.base_price ?? 0),
    duration_minutes: duracao,
    commission_percent: acesso.staff.commissionPercent,
  });

  if (erroServico) {
    // Atendimento sem serviço vinculado vira comissão errada depois.
    // Melhor desfazer e pedir para tentar de novo.
    await admin
      .from('appointments')
      .delete()
      .eq('id', criado.id)
      .eq('staff_id', acesso.staff.staffId);

    return { ok: false, error: 'Não foi possível lançar o serviço. Tente de novo.' };
  }

  // O cliente encaixado tambem recebe o aviso: o atendimento e agora, mas ele
  // vai encontrar o registro no aplicativo depois, com o que foi feito.
  try {
    const texto = avisoDeHorarioMarcado({
      servico: servico.name as string,
      profissional: acesso.staff.displayName,
      quandoISO: inicio.toISOString(),
    });
    await notifyCustomer({
      customerId: dados.customerId,
      type: 'agendamento_confirmado',
      title: texto.titulo,
      body: texto.corpo,
      metadata: { appointment_id: criado.id },
      whatsapp: false,
    });
    await avisarClienteQueMarcamos({
      customerId: dados.customerId,
      quandoISO: inicio.toISOString(),
      servico: servico.name as string,
      profissional: acesso.staff.displayName,
    });
  } catch {
    // Silencio: o encaixe ja esta na agenda
  }

  revalidatePath('/painel');
  revalidatePath('/painel/agenda');
  return { ok: true };
}
