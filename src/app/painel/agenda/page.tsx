import { requireStaff } from '@/lib/staff-auth';
import { podeModulo } from '@/lib/staff-permissions';
import { createAdminClient } from '@/lib/supabase/admin';
import { agendaDoDia, hojeStr, BARBERSHOP_ID } from '@/lib/painel/dados';
import { AgendaView } from './_components/agenda-view';

export const metadata = { title: 'Minha agenda' };
export const dynamic = 'force-dynamic';

interface AgendaPageProps {
  searchParams: Promise<{ data?: string }>;
}

export default async function AgendaPainelPage({ searchParams }: AgendaPageProps) {
  const { data: dataParam } = await searchParams;
  const staff = await requireStaff();

  const data = dataParam && /^\d{4}-\d{2}-\d{2}$/.test(dataParam) ? dataParam : hojeStr();
  const podeOperar = podeModulo(staff, 'agenda_operar');

  // Os serviços vêm junto com a página para o encaixe abrir já preenchido:
  // no balcão, com o cliente esperando em pé, não dá para o barbeiro ficar
  // olhando uma lista carregar depois do clique.
  const [agendamentos, { data: servicos }] = await Promise.all([
    agendaDoDia(staff, data),
    podeOperar
      ? createAdminClient()
          .from('services')
          .select('id, name, base_price, base_duration_minutes')
          .eq('barbershop_id', BARBERSHOP_ID)
          .eq('active', true)
          .order('name')
      : Promise.resolve({ data: [] }),
  ]);

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <p className="text-[10px] text-fg-dim tracking-[0.25em] uppercase mb-1">Agenda</p>
        <h1
          className="text-2xl text-fg font-bold"
          style={{ fontFamily: 'var(--font-playfair), serif' }}
        >
          Meus atendimentos
        </h1>
      </div>

      <AgendaView
        data={data}
        podeOperar={podeOperar}
        servicos={(servicos ?? []).map((s) => ({
          id: s.id as string,
          nome: s.name as string,
          preco: Number(s.base_price ?? 0),
          minutos: Number(s.base_duration_minutes ?? 30),
        }))}
        agendamentos={agendamentos.map((a) => ({
          id: a.id,
          cliente: a.cliente,
          telefone: a.telefone,
          inicio: a.inicio,
          fim: a.fim,
          status: a.status,
          servicos: a.servicos,
          observacao: a.observacao,
          assinatura: a.assinatura,
          confirmacaoPedidaEm: a.confirmacaoPedidaEm,
          confirmadaPeloClienteEm: a.confirmadaPeloClienteEm,
        }))}
      />
    </div>
  );
}
