import Link from 'next/link';
import { Clock, Users, CircleDollarSign, CalendarDays, ArrowRight } from 'lucide-react';
import { requireStaff } from '@/lib/staff-auth';
import { podeModulo } from '@/lib/staff-permissions';
import { resumoDoDia } from '@/lib/painel/dados';
import { montarSelo, corDoSelo } from '@/lib/painel/assinatura-selo';
import { formatCurrency } from '@/lib/utils';

export const metadata = { title: 'Hoje' };
export const dynamic = 'force-dynamic';

function hora(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  });
}

export default async function PainelHomePage() {
  const staff = await requireStaff();
  const resumo = await resumoDoDia(staff);

  const veFinanceiro = podeModulo(staff, 'financeiro');
  const selo = resumo.proximo
    ? montarSelo(resumo.proximo.assinatura, new Date(resumo.proximo.inicio))
    : null;

  const primeiroNome = staff.displayName.split(' ')[0];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <p className="text-[10px] text-fg-dim tracking-[0.25em] uppercase mb-1">
          {new Date().toLocaleDateString('pt-BR', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            timeZone: 'America/Sao_Paulo',
          })}
        </p>
        <h1
          className="text-3xl text-fg font-bold"
          style={{ fontFamily: 'var(--font-playfair), serif' }}
        >
          Olá, {primeiroNome}
        </h1>
      </div>

      {/* Próximo cliente */}
      <section className="card p-5">
        <p className="text-[10px] text-fg-dim tracking-[0.25em] uppercase mb-3">
          Próximo cliente
        </p>

        {resumo.proximo ? (
          <div className="space-y-2">
            <div className="flex items-baseline gap-3">
              <span className="text-2xl font-bold text-gold">
                {hora(resumo.proximo.inicio)}
              </span>
              <span className="text-lg text-fg">{resumo.proximo.cliente}</span>
            </div>

            {resumo.proximo.servicos.length > 0 && (
              <p className="text-sm text-fg-muted">
                {resumo.proximo.servicos.join(', ')}
              </p>
            )}

            {selo && selo.situacao !== 'sem_assinatura' && (
              <span
                className={`inline-block text-xs px-2 py-1 rounded-md border ${corDoSelo(
                  selo.situacao
                )}`}
              >
                {selo.texto}
              </span>
            )}
          </div>
        ) : (
          <p className="text-sm text-fg-muted">
            Nenhum cliente à frente por enquanto. Aproveite para organizar a estação.
          </p>
        )}
      </section>

      {/* Números do dia */}
      <section className="grid grid-cols-2 gap-3">
        <div className="card p-4">
          <Users className="w-5 h-5 text-gold mb-2" />
          <p className="text-2xl font-bold text-fg">{resumo.clientesHoje}</p>
          <p className="text-xs text-fg-muted">
            {resumo.clientesHoje === 1 ? 'cliente hoje' : 'clientes hoje'}
          </p>
        </div>

        <div className="card p-4">
          <Clock className="w-5 h-5 text-gold mb-2" />
          <p className="text-2xl font-bold text-fg">{resumo.concluidosHoje}</p>
          <p className="text-xs text-fg-muted">já atendidos</p>
        </div>

        {veFinanceiro && (
          <>
            <div className="card p-4">
              <CircleDollarSign className="w-5 h-5 text-gold mb-2" />
              <p className="text-2xl font-bold text-fg">
                {formatCurrency(resumo.produzidoHoje)}
              </p>
              <p className="text-xs text-fg-muted">produzido hoje</p>
            </div>

            <div className="card p-4">
              <CircleDollarSign className="w-5 h-5 text-success mb-2" />
              <p className="text-2xl font-bold text-success">
                {formatCurrency(resumo.comissaoHoje)}
              </p>
              <p className="text-xs text-fg-muted">sua comissão hoje</p>
            </div>
          </>
        )}
      </section>

      <Link
        href="/painel/agenda"
        className="card card-hover p-4 flex items-center justify-between"
      >
        <span className="flex items-center gap-3">
          <CalendarDays className="w-5 h-5 text-gold" />
          <span className="text-sm text-fg">Ver minha agenda completa</span>
        </span>
        <ArrowRight className="w-4 h-4 text-fg-muted" />
      </Link>
    </div>
  );
}
