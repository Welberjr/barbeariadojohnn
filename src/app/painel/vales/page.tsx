import { requireStaff } from '@/lib/staff-auth';
import { podeModulo } from '@/lib/staff-permissions';
import { valesDoStaff, financeiroDoPeriodo } from '@/lib/painel/dados';
import { ValesView } from './_components/vales-view';

export const metadata = { title: 'Meus vales' };
export const dynamic = 'force-dynamic';

function limitesDoMesAtual() {
  const agora = new Date();
  const mes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
  })
    .format(agora)
    .slice(0, 7);

  const [ano, m] = mes.split('-').map(Number);
  const ultimo = new Date(ano, m, 0).getDate();
  return { from: `${mes}-01`, to: `${mes}-${String(ultimo).padStart(2, '0')}` };
}

export default async function ValesPage() {
  const staff = await requireStaff('vales_ver');
  const { from, to } = limitesDoMesAtual();

  const [vales, financeiro] = await Promise.all([
    valesDoStaff(staff),
    financeiroDoPeriodo(staff, from, to),
  ]);

  // O saldo previsto só aparece para quem enxerga o próprio financeiro
  const veFinanceiro = podeModulo(staff, 'financeiro');

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <p className="text-[10px] text-fg-dim tracking-[0.25em] uppercase mb-1">Vales</p>
        <h1
          className="text-2xl text-fg font-bold"
          style={{ fontFamily: 'var(--font-playfair), serif' }}
        >
          Meus vales
        </h1>
      </div>

      <ValesView
        vales={vales}
        podePedir={podeModulo(staff, 'vales_pedir')}
        totalDescontadoNoMes={financeiro.valesDescontados}
        saldoPrevisto={veFinanceiro ? financeiro.liquido : null}
      />
    </div>
  );
}
