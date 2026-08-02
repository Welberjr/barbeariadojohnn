import Link from 'next/link';
import { ChevronRight, Plus } from 'lucide-react';
import { requireStaff } from '@/lib/staff-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { hojeStr, limitesDoDia, agendaDoDia } from '@/lib/painel/dados';
import { lojaAtual } from '@/lib/loja';
import { formatCurrency } from '@/lib/utils';
import { AbrirComandaBotao } from './_components/abrir-comanda-botao';

export const metadata = { title: 'Minhas comandas' };
export const dynamic = 'force-dynamic';

export default async function ComandasPainelPage() {
  const staff = await requireStaff('comanda');
  const admin = createAdminClient();
  const hoje = hojeStr();
  const { inicio, fim } = limitesDoDia(hoje);

  const [{ data: abertas }, { data: fechadasHoje }, agenda] = await Promise.all([
    admin
      .from('comandas')
      .select('id, total, opened_at, customers:customers ( full_name )')
      .eq('barbershop_id', (await lojaAtual()))
      .eq('staff_id', staff.staffId)
      .eq('status', 'open')
      .order('opened_at', { ascending: false }),
    admin
      .from('comandas')
      .select('id, total, closed_at, customers:customers ( full_name )')
      .eq('barbershop_id', (await lojaAtual()))
      .eq('staff_id', staff.staffId)
      .eq('status', 'closed')
      .gte('closed_at', inicio)
      .lte('closed_at', fim)
      .order('closed_at', { ascending: false }),
    agendaDoDia(staff, hoje),
  ]);

  // Atendimentos de hoje que ainda não viraram comanda
  const semComanda = agenda.filter(
    (a) => !a.comandaId && !['cancelled', 'no_show'].includes(a.status) && a.customerId
  );

  const totalFechadoHoje = (fechadasHoje ?? []).reduce(
    (s, c) => s + Number(c.total ?? 0),
    0
  );

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <p className="text-[10px] text-fg-dim tracking-[0.25em] uppercase mb-1">Comandas</p>
        <h1
          className="text-2xl text-fg font-bold"
          style={{ fontFamily: 'var(--font-playfair), serif' }}
        >
          Minhas comandas
        </h1>
      </div>

      {/* Abertas */}
      <section className="space-y-3">
        <p className="text-[10px] text-fg-dim tracking-[0.25em] uppercase">Em aberto</p>

        {(abertas ?? []).length === 0 ? (
          <div className="card p-6 text-center">
            <p className="text-sm text-fg-muted">Nenhuma comanda aberta agora.</p>
          </div>
        ) : (
          (abertas ?? []).map((c) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const cliente = c.customers as any;
            return (
              <Link
                key={c.id as string}
                href={`/painel/comandas/${c.id}`}
                className="card card-hover p-4 flex items-center justify-between"
              >
                <span>
                  <span className="block text-base text-fg">
                    {cliente?.full_name ?? 'Cliente'}
                  </span>
                  <span className="block text-xs text-fg-muted">
                    Aberta às{' '}
                    {new Date(c.opened_at as string).toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit',
                      timeZone: 'America/Sao_Paulo',
                    })}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <span className="text-base font-bold text-gold">
                    {formatCurrency(Number(c.total ?? 0))}
                  </span>
                  <ChevronRight className="w-4 h-4 text-fg-muted" />
                </span>
              </Link>
            );
          })
        )}
      </section>

      {/* Atendimentos do dia sem comanda */}
      {semComanda.length > 0 && (
        <section className="space-y-3">
          <p className="text-[10px] text-fg-dim tracking-[0.25em] uppercase">
            Atendimentos de hoje sem comanda
          </p>

          {semComanda.map((a) => (
            <div key={a.id} className="card p-4 flex items-center justify-between gap-3">
              <span className="min-w-0">
                <span className="block text-sm text-fg truncate">{a.cliente}</span>
                <span className="block text-xs text-fg-muted">
                  {new Date(a.inicio).toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit',
                    timeZone: 'America/Sao_Paulo',
                  })}
                  {a.servicos.length > 0 ? ` · ${a.servicos.join(', ')}` : ''}
                </span>
              </span>

              <AbrirComandaBotao appointmentId={a.id} />
            </div>
          ))}
        </section>
      )}

      {/* Fechadas hoje */}
      <section className="space-y-3">
        <p className="text-[10px] text-fg-dim tracking-[0.25em] uppercase">
          Fechadas hoje
        </p>

        {(fechadasHoje ?? []).length === 0 ? (
          <div className="card p-6 text-center">
            <p className="text-sm text-fg-muted">Nenhuma comanda fechada hoje ainda.</p>
          </div>
        ) : (
          <>
            {(fechadasHoje ?? []).map((c) => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const cliente = c.customers as any;
              return (
                <Link
                  key={c.id as string}
                  href={`/painel/comandas/${c.id}`}
                  className="card card-hover p-4 flex items-center justify-between"
                >
                  <span className="text-sm text-fg">{cliente?.full_name ?? 'Cliente'}</span>
                  <span className="text-sm text-fg-muted">
                    {formatCurrency(Number(c.total ?? 0))}
                  </span>
                </Link>
              );
            })}
            <p className="text-xs text-fg-subtle text-right">
              Total fechado hoje: {formatCurrency(totalFechadoHoje)}
            </p>
          </>
        )}
      </section>

      <div className="pt-2">
        <AbrirComandaBotao variante="avulsa" rotulo="Abrir comanda para um cliente" icone={<Plus className="w-4 h-4" />} />
      </div>
    </div>
  );
}
