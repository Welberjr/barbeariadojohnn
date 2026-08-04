import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { notifyCustomer } from '@/lib/notifications';
import { isAuthorizedCronRequest } from '@/lib/cron-auth';
import {
  devePedirConfirmacao,
  textoDoPedido,
  HORAS_ANTES_PADRAO,
} from '@/lib/confirmacao-agendamento';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type AdminClient = ReturnType<typeof createAdminClient>;

async function processarUnidade(
  admin: AdminClient,
  unidade: { id: string; confirmation_hours_before: number | null },
  agora: Date
) {
  const horasAntes = Number(
    unidade.confirmation_hours_before ?? HORAS_ANTES_PADRAO
  );
  const limite = new Date(agora.getTime() + (horasAntes + 2) * 3600000);
  const { data: agendamentos, error } = await admin
    .from('appointments')
    .select('id, customer_id, staff_id, start_at, status, confirmation_requested_at, confirmed_by_customer_at')
    .eq('barbershop_id', unidade.id)
    .eq('status', 'scheduled')
    .is('confirmation_requested_at', null)
    .gte('start_at', agora.toISOString())
    .lte('start_at', limite.toISOString())
    .limit(200);

  if (error) throw new Error(error.message);
  const naJanela = (agendamentos ?? []).filter((agendamento) =>
    devePedirConfirmacao(
      {
        status: agendamento.status as string,
        inicio: new Date(agendamento.start_at as string),
        pedidaEm: null,
        confirmadaEm: agendamento.confirmed_by_customer_at
          ? new Date(agendamento.confirmed_by_customer_at as string)
          : null,
      },
      agora,
      horasAntes
    )
  );
  if (!naJanela.length) return { pedidos: 0, semCliente: 0 };

  const idsClientes = [...new Set(naJanela.map((a) => a.customer_id).filter(Boolean))] as string[];
  const idsStaff = [...new Set(naJanela.map((a) => a.staff_id).filter(Boolean))] as string[];
  const idsAgendamento = naJanela.map((a) => a.id as string);
  const [{ data: clientes }, { data: profissionais }, { data: servicosDoAgendamento }] =
    await Promise.all([
      idsClientes.length
        ? admin.from('customers').select('id, full_name').eq('barbershop_id', unidade.id).in('id', idsClientes)
        : Promise.resolve({ data: [] }),
      idsStaff.length
        ? admin.from('staff').select('id, display_name').eq('barbershop_id', unidade.id).in('id', idsStaff)
        : Promise.resolve({ data: [] }),
      admin.from('appointment_services').select('appointment_id, service_id').eq('barbershop_id', unidade.id).in('appointment_id', idsAgendamento),
    ]);
  const idsServico = [...new Set((servicosDoAgendamento ?? []).map((s) => s.service_id).filter(Boolean))] as string[];
  const { data: servicos } = idsServico.length
    ? await admin.from('services').select('id, name').eq('barbershop_id', unidade.id).in('id', idsServico)
    : { data: [] };
  const nomeCliente = new Map((clientes ?? []).map((c) => [c.id as string, c.full_name as string]));
  const nomeProfissional = new Map((profissionais ?? []).map((p) => [p.id as string, p.display_name as string]));
  const nomeServico = new Map((servicos ?? []).map((s) => [s.id as string, s.name as string]));
  const servicosPorAgendamento = new Map<string, string[]>();
  for (const item of servicosDoAgendamento ?? []) {
    const lista = servicosPorAgendamento.get(item.appointment_id as string) ?? [];
    const nome = nomeServico.get(item.service_id as string);
    if (nome) lista.push(nome);
    servicosPorAgendamento.set(item.appointment_id as string, lista);
  }

  let pedidos = 0;
  let semCliente = 0;
  for (const agendamento of naJanela) {
    const customerId = agendamento.customer_id as string | null;
    if (!customerId || !nomeCliente.has(customerId)) {
      semCliente++;
      continue;
    }
    // Atualização condicional: duas execuções não enviam o mesmo aviso.
    const { data: marcado } = await admin
      .from('appointments')
      .update({ confirmation_requested_at: new Date().toISOString() })
      .eq('id', agendamento.id)
      .eq('barbershop_id', unidade.id)
      .is('confirmation_requested_at', null)
      .select('id')
      .maybeSingle();
    if (!marcado) continue;

    const texto = textoDoPedido({
      primeiroNome: (nomeCliente.get(customerId) ?? 'Cliente').split(' ')[0],
      servico: (servicosPorAgendamento.get(agendamento.id as string) ?? []).join(' + ') || 'atendimento',
      inicio: new Date(agendamento.start_at as string),
      profissional: agendamento.staff_id
        ? nomeProfissional.get(agendamento.staff_id as string) ?? null
        : null,
    });
    await notifyCustomer({
      customerId,
      type: 'confirmacao_pedida',
      title: texto.titulo,
      body: texto.corpo,
      metadata: { appointment_id: agendamento.id },
      whatsapp: false,
    });
    pedidos++;
  }
  return { pedidos, semCliente };
}

export async function GET(req: NextRequest) {
  if (!isAuthorizedCronRequest(req.headers.get('authorization'), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const admin = createAdminClient();
    const { data: unidades, error } = await admin
      .from('barbershops')
      .select('id, confirmation_hours_before')
      .eq('active', true);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const resultados = await Promise.all(
      (unidades ?? []).map((unidade) =>
        processarUnidade(
          admin,
          {
            id: unidade.id as string,
            confirmation_hours_before: unidade.confirmation_hours_before as number | null,
          },
          new Date()
        )
      )
    );
    return NextResponse.json({
      ok: true,
      unidades: resultados.length,
      pedidos: resultados.reduce((total, item) => total + item.pedidos, 0),
      semCliente: resultados.reduce((total, item) => total + item.semCliente, 0),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro interno' },
      { status: 500 }
    );
  }
}
