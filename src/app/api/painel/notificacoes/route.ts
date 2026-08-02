/**
 * Avisos do barbeiro.
 *
 * O painel nasceu sem sino nenhum: o Davi so ficava sabendo de cliente novo na
 * agenda dele se abrisse a agenda e reparasse. Aqui ele ve o que mudou no dia
 * dele desde a ultima vez que olhou.
 *
 * Sao avisos calculados na hora, nao guardados. Isso significa que nao existe
 * "aviso perdido": a lista sempre reflete a situacao de agora, e nao um recado
 * antigo que ficou preso numa fila.
 *
 * So mostra o que e do proprio barbeiro. Ele nao ve movimento dos colegas.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireStaff } from '@/lib/staff-auth';
import { desdeQuandoOlhar, quandoEmPalavras, haQuantoTempo } from '@/lib/avisos';
import { lojaAtual } from '@/lib/loja';

export const dynamic = 'force-dynamic';

export interface AvisoDoPainel {
  tipo: 'agendamento' | 'cancelamento' | 'vale' | 'comanda';
  cor: 'info' | 'ouro' | 'perigo';
  titulo: string;
  detalhe: string;
  href: string;
}

export async function GET(req: NextRequest) {
  const staff = await requireStaff();
  const admin = createAdminClient();

  const desde = desdeQuandoOlhar(req.nextUrl.searchParams.get('desde'));
  const agora = new Date();
  const hoje = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
  }).format(agora);

  const [novosRes, desmarcadosRes, valesRes, comandasRes] = await Promise.all([
    // Cliente novo na agenda dele, marcado por qualquer porta
    admin
      .from('appointments')
      .select('id, start_at, created_at, source, customers:customers(full_name)')
      .eq('barbershop_id', (await lojaAtual()))
      .eq('staff_id', staff.staffId)
      .neq('status', 'cancelled')
      .gte('created_at', desde)
      .gte('start_at', agora.toISOString())
      .order('created_at', { ascending: false })
      .limit(10),
    // Horario que sumiu da agenda dele
    admin
      .from('appointments')
      .select('id, start_at, cancelled_at, customers:customers(full_name)')
      .eq('barbershop_id', (await lojaAtual()))
      .eq('staff_id', staff.staffId)
      .eq('status', 'cancelled')
      .gte('cancelled_at', desde)
      .order('cancelled_at', { ascending: false })
      .limit(10),
    // Vale dele que a gestao respondeu
    admin
      .from('allowances')
      .select('id, amount, status, updated_at')
      .eq('barbershop_id', (await lojaAtual()))
      .eq('staff_id', staff.staffId)
      .in('status', ['approved', 'rejected'])
      .gte('updated_at', desde)
      .order('updated_at', { ascending: false })
      .limit(5),
    // Comanda dele que ficou aberta
    admin
      .from('comandas')
      .select('id, opened_at, customers:customers(full_name)')
      .eq('barbershop_id', (await lojaAtual()))
      .eq('staff_id', staff.staffId)
      .eq('status', 'open')
      .order('opened_at')
      .limit(5),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nomeDe = (rel: any): string => {
    const v = Array.isArray(rel) ? rel[0]?.full_name : rel?.full_name;
    return (v as string) ?? 'Cliente';
  };

  const avisos: AvisoDoPainel[] = [];

  for (const a of novosRes.data ?? []) {
    const daPropriaCasa = a.source !== 'public_site';
    avisos.push({
      tipo: 'agendamento',
      cor: 'info',
      titulo: `${nomeDe(a.customers)} na sua agenda`,
      detalhe: `${quandoEmPalavras(a.start_at as string)}${
        daPropriaCasa ? ' · marcado na loja' : ' · marcou pelo aplicativo'
      } · ${haQuantoTempo(a.created_at as string, agora)}`,
      href: '/painel/agenda',
    });
  }

  for (const a of desmarcadosRes.data ?? []) {
    avisos.push({
      tipo: 'cancelamento',
      cor: 'ouro',
      titulo: `${nomeDe(a.customers)} desmarcou`,
      detalhe: `Era ${quandoEmPalavras(a.start_at as string)} · ${haQuantoTempo(
        a.cancelled_at as string,
        agora
      )}`,
      href: '/painel/agenda',
    });
  }

  for (const v of valesRes.data ?? []) {
    const valor = Number(v.amount ?? 0).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
    avisos.push({
      tipo: 'vale',
      cor: v.status === 'approved' ? 'info' : 'perigo',
      titulo: v.status === 'approved' ? 'Vale aprovado' : 'Vale recusado',
      detalhe: `${valor} · ${haQuantoTempo(v.updated_at as string, agora)}`,
      href: '/painel/vales',
    });
  }

  // Comanda esquecida aberta e dinheiro que ainda nao entrou. Vale lembrar
  // mesmo que ele ja tenha olhado o sino: nao e novidade, e pendencia.
  for (const c of comandasRes.data ?? []) {
    const minutos = Math.floor(
      (agora.getTime() - new Date(c.opened_at as string).getTime()) / 60000
    );
    if (minutos < 90) continue;
    avisos.push({
      tipo: 'comanda',
      cor: 'ouro',
      titulo: 'Comanda sua ainda aberta',
      detalhe: `${nomeDe(c.customers)} · ${haQuantoTempo(c.opened_at as string, agora)}`,
      href: `/painel/comandas/${c.id}`,
    });
  }

  return NextResponse.json({ hoje, quantidade: avisos.length, avisos });
}
