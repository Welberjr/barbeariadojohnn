export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Pedido de confirmacao de presenca.
 *
 * Roda uma vez por dia, as 13h UTC, que sao 10h de Brasilia: o aviso chega em
 * hora de gente acordada e sobra o dia inteiro para o cliente responder antes do
 * atendimento do dia seguinte. O horario esta em vercel.json, que e um arquivo
 * de configuracao validado pela Vercel e nao aceita comentario nenhum dentro,
 * entao a explicacao mora aqui.
 *
 * Avisa quem tem atendimento chegando. O aviso vai para o aplicativo do cliente, nao para o WhatsApp: a
 * barbearia decidiu que o WhatsApp fica com uma pessoa de verdade, e o robo nao
 * fala com cliente.
 *
 * O cliente responde na tela dele. Confirmou, o barbeiro ve o selo verde na
 * agenda e sabe que a cadeira esta garantida. Nao respondeu, aparece o aviso
 * para a recepcao correr atras antes de perder o horario.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { notifyCustomer } from '@/lib/notifications';
import { lojaPadrao } from '@/lib/loja';
import {
  devePedirConfirmacao,
  textoDoPedido,
  HORAS_ANTES_PADRAO,
} from '@/lib/confirmacao-agendamento';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const admin = createAdminClient();
    const agora = new Date();

    const { data: barbearia } = await admin
      .from('barbershops')
      .select('name, confirmation_hours_before')
      .eq('id', (await lojaPadrao()))
      .maybeSingle();

    const horasAntes = Number(
      barbearia?.confirmation_hours_before ?? HORAS_ANTES_PADRAO
    );

    // Busca uma janela um pouco maior que a configurada e deixa a regra decidir
    // quem entra. Assim, uma rodada atrasada nao deixa ninguem sem aviso.
    const limite = new Date(agora.getTime() + (horasAntes + 2) * 3600000);

    const { data: agendamentos, error } = await admin
      .from('appointments')
      .select(
        'id, customer_id, staff_id, start_at, status, confirmation_requested_at, confirmed_by_customer_at'
      )
      .eq('barbershop_id', (await lojaPadrao()))
      .eq('status', 'scheduled')
      .is('confirmation_requested_at', null)
      .gte('start_at', agora.toISOString())
      .lte('start_at', limite.toISOString())
      .limit(200);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const naJanela = (agendamentos ?? []).filter((a) =>
      devePedirConfirmacao(
        {
          status: a.status as string,
          inicio: new Date(a.start_at as string),
          pedidaEm: null,
          confirmadaEm: (a.confirmed_by_customer_at as string)
            ? new Date(a.confirmed_by_customer_at as string)
            : null,
        },
        agora,
        horasAntes
      )
    );

    if (naJanela.length === 0) {
      return NextResponse.json({
        ok: true,
        pedidos: 0,
        mensagem: 'Ninguém para avisar nesta rodada.',
      });
    }

    // Dados de apoio de uma vez só, para não consultar dentro do laço
    const idsClientes = [
      ...new Set(naJanela.map((a) => a.customer_id).filter(Boolean)),
    ] as string[];
    const idsStaff = [
      ...new Set(naJanela.map((a) => a.staff_id).filter(Boolean)),
    ] as string[];
    const idsAgendamento = naJanela.map((a) => a.id as string);

    const [{ data: clientes }, { data: profissionais }, { data: servicosDoAgendamento }] =
      await Promise.all([
        idsClientes.length
          ? admin.from('customers').select('id, full_name').in('id', idsClientes)
          : Promise.resolve({ data: [] }),
        idsStaff.length
          ? admin.from('staff').select('id, display_name').in('id', idsStaff)
          : Promise.resolve({ data: [] }),
        admin
          .from('appointment_services')
          .select('appointment_id, service_id')
          .in('appointment_id', idsAgendamento),
      ]);

    const idsServico = [
      ...new Set((servicosDoAgendamento ?? []).map((s) => s.service_id).filter(Boolean)),
    ] as string[];

    const { data: servicos } = idsServico.length
      ? await admin.from('services').select('id, name').in('id', idsServico)
      : { data: [] };

    const nomeCliente = new Map(
      (clientes ?? []).map((c) => [c.id as string, c.full_name as string])
    );
    const nomeProfissional = new Map(
      (profissionais ?? []).map((s) => [s.id as string, s.display_name as string])
    );
    const nomeServico = new Map(
      (servicos ?? []).map((s) => [s.id as string, s.name as string])
    );

    const servicosPorAgendamento = new Map<string, string[]>();
    for (const item of servicosDoAgendamento ?? []) {
      const lista = servicosPorAgendamento.get(item.appointment_id as string) ?? [];
      const nome = nomeServico.get(item.service_id as string);
      if (nome) lista.push(nome);
      servicosPorAgendamento.set(item.appointment_id as string, lista);
    }

    let enviados = 0;
    let semCliente = 0;

    for (const a of naJanela) {
      const clienteId = a.customer_id as string | null;
      if (!clienteId || !nomeCliente.has(clienteId)) {
        semCliente++;
        continue;
      }

      // Marca antes de avisar. Se o aviso falhar, o cliente fica sem a
      // notificacao desta rodada, o que e bem menos ruim do que receber o
      // mesmo pedido de hora em hora ate o dia do corte.
      const { data: marcado } = await admin
        .from('appointments')
        .update({ confirmation_requested_at: new Date().toISOString() })
        .eq('id', a.id)
        .is('confirmation_requested_at', null)
        .select('id')
        .maybeSingle();

      if (!marcado) continue;

      const servicos = servicosPorAgendamento.get(a.id as string) ?? [];
      const texto = textoDoPedido({
        primeiroNome: (nomeCliente.get(clienteId) ?? 'Cliente').split(' ')[0],
        servico: servicos.length ? servicos.join(' + ') : 'atendimento',
        inicio: new Date(a.start_at as string),
        profissional: a.staff_id
          ? nomeProfissional.get(a.staff_id as string) ?? null
          : null,
      });

      await notifyCustomer({
        customerId: clienteId,
        type: 'confirmacao_pedida',
        title: texto.titulo,
        body: texto.corpo,
        metadata: { appointment_id: a.id },
        // O WhatsApp fica com uma pessoa de verdade: o robo so avisa no app
        whatsapp: false,
      });

      enviados++;
    }

    return NextResponse.json({
      ok: true,
      pedidos: enviados,
      semCliente,
      janelaHoras: horasAntes,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro interno' },
      { status: 500 }
    );
  }
}
