import Link from 'next/link';
import { ChevronLeft, ChevronRight, Info } from 'lucide-react';
import { requireStaff } from '@/lib/staff-auth';
import { podeModulo } from '@/lib/staff-permissions';
import { financeiroDoPeriodo } from '@/lib/painel/dados';
import { formatCurrency, primeiraMaiuscula } from '@/lib/utils';

export const metadata = { title: 'Meu financeiro' };
export const dynamic = 'force-dynamic';

interface FinanceiroPageProps {
  searchParams: Promise<{ mes?: string }>;
}

/** Mes corrente no fuso da barbearia, no formato yyyy-mm. */
function mesAtual(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
  })
    .format(new Date())
    .slice(0, 7);
}

function somarMeses(mes: string, delta: number): string {
  const [ano, m] = mes.split('-').map(Number);
  const d = new Date(ano, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function limitesDoMes(mes: string) {
  const [ano, m] = mes.split('-').map(Number);
  const ultimo = new Date(ano, m, 0).getDate();
  return { from: `${mes}-01`, to: `${mes}-${String(ultimo).padStart(2, '0')}` };
}

function mesLegivel(mes: string) {
  const [ano, m] = mes.split('-').map(Number);
  return new Date(ano, m - 1, 1).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  });
}

export default async function FinanceiroPainelPage({ searchParams }: FinanceiroPageProps) {
  const staff = await requireStaff('financeiro');
  const { mes: mesParam } = await searchParams;

  const mes = mesParam && /^\d{4}-\d{2}$/.test(mesParam) ? mesParam : mesAtual();
  const { from, to } = limitesDoMes(mes);
  const dados = await financeiroDoPeriodo(staff, from, to);

  const veVales = podeModulo(staff, 'vales_ver');

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <p className="text-[10px] text-fg-dim tracking-[0.25em] uppercase mb-1">Financeiro</p>
        <h1
          className="text-2xl text-fg font-bold"
          style={{ fontFamily: 'var(--font-playfair), serif' }}
        >
          Minha produção
        </h1>
      </div>

      {/* Navegação de mês */}
      <div className="flex items-center justify-between gap-2">
        <Link href={`/painel/financeiro?mes=${somarMeses(mes, -1)}`} className="btn-ghost p-3">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <p className="text-sm text-fg font-medium">{primeiraMaiuscula(mesLegivel(mes))}</p>
        <Link href={`/painel/financeiro?mes=${somarMeses(mes, 1)}`} className="btn-ghost p-3">
          <ChevronRight className="w-5 h-5" />
        </Link>
      </div>

      {/* Resultado */}
      <section className="card p-5 space-y-4">
        <div>
          <p className="text-xs text-fg-muted">A receber no período</p>
          <p className="text-3xl font-bold text-success">{formatCurrency(dados.liquido)}</p>
          <p className="text-xs text-fg-subtle mt-1">
            Comissão de {formatCurrency(dados.comissao)}
            {veVales && dados.valesDescontados > 0
              ? `, menos ${formatCurrency(dados.valesDescontados)} de vales`
              : ''}
            .
          </p>
        </div>

        {dados.jaPago > 0 && (
          <p className="text-xs text-fg-muted">
            Já recebido neste período: {formatCurrency(dados.jaPago)}
          </p>
        )}
      </section>

      {/* Produção */}
      <section className="grid grid-cols-2 gap-3">
        <div className="card p-4">
          <p className="text-xs text-fg-muted">Serviços</p>
          <p className="text-xl font-bold text-fg">{formatCurrency(dados.producaoServicos)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-fg-muted">Produtos</p>
          <p className="text-xl font-bold text-fg">{formatCurrency(dados.producaoProdutos)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-fg-muted">Atendimentos</p>
          <p className="text-xl font-bold text-fg">{dados.atendimentos}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-fg-muted">Ticket médio</p>
          <p className="text-xl font-bold text-fg">{formatCurrency(dados.ticketMedio)}</p>
        </div>
      </section>

      {/* Assinaturas */}
      <section className="card p-5 space-y-3">
        <p className="text-[10px] text-fg-dim tracking-[0.25em] uppercase">Assinaturas</p>

        <div className="flex items-baseline justify-between">
          <span className="text-sm text-fg-muted">Assinantes atendidos</span>
          <span className="text-lg font-bold text-fg">{dados.assinaturaAtendimentos}</span>
        </div>

        <div className="flex items-baseline justify-between">
          <span className="text-sm text-fg-muted">Já recebido de assinatura</span>
          <span className="text-lg font-bold text-fg">
            {formatCurrency(dados.assinaturaPotinhoPago)}
          </span>
        </div>

        <div className="flex items-baseline justify-between">
          <span className="text-sm text-fg-muted">Estimativa dos ciclos abertos</span>
          <span className="text-lg font-bold text-gold">
            {formatCurrency(dados.assinaturaPotinhoEstimado)}
          </span>
        </div>

        <p className="text-xs text-fg-subtle flex gap-2">
          <Info className="w-4 h-4 text-gold shrink-0 mt-0.5" />
          A estimativa é uma previsão, não um valor fechado. O valor de assinatura é dividido entre
          quem atendeu o assinante no ciclo, então ele muda se um colega atender o mesmo cliente
          antes da renovação.
        </p>
      </section>

      {veVales && (
        <Link href="/painel/vales" className="card card-hover p-4 flex items-center justify-between">
          <span className="text-sm text-fg">Ver meus vales</span>
          <ChevronRight className="w-4 h-4 text-fg-muted" />
        </Link>
      )}
    </div>
  );
}
