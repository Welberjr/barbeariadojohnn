import { requireStaff } from '@/lib/staff-auth';
import { podeModulo } from '@/lib/staff-permissions';
import { agendaDoDia, hojeStr } from '@/lib/painel/dados';
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
  const agendamentos = await agendaDoDia(staff, data);

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
        podeOperar={podeModulo(staff, 'agenda_operar')}
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
        }))}
      />
    </div>
  );
}
