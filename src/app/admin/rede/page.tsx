/**
 * Painel do dono: a rede inteira numa tela.
 *
 * So aparece no menu para quem tem mais de uma unidade. Com uma loja so, esta
 * tela seria uma copia pior do painel de sempre.
 */
import Link from 'next/link';
import { Store, CircleDollarSign, Users, Scissors, ArrowRight } from 'lucide-react';
import { requireCanManage } from '@/lib/staff-auth';
import { retratoDaRede } from '@/lib/rede';
import { formatCurrency } from '@/lib/utils';

export const metadata = { title: 'Rede' };
export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Promise<{ de?: string; ate?: string }>;
}

function dataCurta(iso: string) {
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a.slice(2)}`;
}

export default async function RedePage({ searchParams }: Props) {
  const { de, ate } = await searchParams;
  const staff = await requireCanManage();
  const rede = await retratoDaRede({ userId: staff.userId, de, ate });

  if (rede.unidades.length < 2) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div>
          <p className="mb-1 text-[10px] uppercase tracking-[0.25em] text-fg-dim">Rede</p>
          <h1
            className="text-3xl font-bold text-fg"
            style={{ fontFamily: 'var(--font-playfair), serif' }}
          >
            Visão da rede
          </h1>
        </div>
        <div className="card space-y-3 p-6">
          <p className="text-sm text-fg">Esta tela compara as suas unidades.</p>
          <p className="text-[11px] leading-relaxed text-fg-subtle">
            Você administra uma unidade só, então ela não tem o que comparar ainda. Quando
            a segunda existir, aqui aparecem as duas lado a lado: faturamento, atendimentos,
            ticket médio e o quanto cada uma representa da rede.
          </p>
          <Link href="/admin/lojas" className="btn-gold-outline text-xs">
            <Store className="h-3.5 w-3.5" />
            Ver as unidades
          </Link>
        </div>
      </div>
    );
  }

  const lider = rede.unidades[0];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <p className="mb-1 text-[10px] uppercase tracking-[0.25em] text-fg-dim">Rede</p>
        <h1
          className="text-3xl font-bold text-fg"
          style={{ fontFamily: 'var(--font-playfair), serif' }}
        >
          Visão da rede
        </h1>
        <p className="mt-2 text-sm text-fg-muted">
          {rede.unidades.length} unidades · {dataCurta(rede.de)} a {dataCurta(rede.ate)}
        </p>
      </div>

      <div className="divider-gold" />

      {/* A soma da rede */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card p-5">
          <p className="text-[10px] uppercase tracking-wider text-fg-dim">Faturamento</p>
          <p className="mt-1 text-2xl font-bold text-gold">
            {formatCurrency(rede.faturamento)}
          </p>
          <p className="mt-1 text-[11px] text-fg-subtle">
            {rede.atendimentos} atendimentos
          </p>
        </div>
        <div className="card p-5">
          <p className="text-[10px] uppercase tracking-wider text-fg-dim">Ticket médio</p>
          <p className="mt-1 text-2xl font-bold text-fg">{formatCurrency(rede.ticket)}</p>
          <p className="mt-1 text-[11px] text-fg-subtle">Da rede inteira</p>
        </div>
        <div className="card p-5">
          <p className="text-[10px] uppercase tracking-wider text-fg-dim">Comissões</p>
          <p className="mt-1 text-2xl font-bold text-fg">{formatCurrency(rede.comissoes)}</p>
          <p className="mt-1 text-[11px] text-fg-subtle">{rede.equipe} profissionais</p>
        </div>
        <div className="card p-5">
          <p className="text-[10px] uppercase tracking-wider text-fg-dim">Clientes</p>
          <p className="mt-1 text-2xl font-bold text-fg">{rede.clientes}</p>
          <p className="mt-1 text-[11px] text-fg-subtle">Somando as unidades</p>
        </div>
      </div>

      {/* Unidade por unidade */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-fg" style={{ fontFamily: 'var(--font-playfair), serif' }}>
          Unidade por unidade
        </h2>

        {rede.unidades.map((u) => (
          <div key={u.id} className="card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-semibold text-fg">
                  <Store className="h-4 w-4 text-gold" />
                  {u.nome}
                  {u.id === lider.id && rede.unidades.length > 1 && (
                    <span className="rounded bg-gold/15 px-1.5 py-0.5 text-[10px] text-gold">
                      maior faturamento
                    </span>
                  )}
                </p>
                {u.cidade && <p className="mt-0.5 text-[11px] text-fg-subtle">{u.cidade}</p>}
              </div>
              <p className="text-xl font-bold text-gold">{formatCurrency(u.faturamento)}</p>
            </div>

            {/* Quanto esta unidade representa da rede */}
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-bg-elevated">
              <div
                className="h-full rounded-full bg-gold/70"
                style={{ width: `${Math.max(2, Math.round(u.fatiaDaRede))}%` }}
              />
            </div>
            <p className="mt-1 text-[10px] text-fg-dim">
              {u.fatiaDaRede.toFixed(1)}% do faturamento da rede
            </p>

            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-fg-dim">
                  Atendimentos
                </p>
                <p className="text-sm text-fg">{u.atendimentos}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-fg-dim">Ticket</p>
                <p className="text-sm text-fg">{formatCurrency(u.ticket)}</p>
              </div>
              <div>
                <p className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-fg-dim">
                  <Scissors className="h-2.5 w-2.5" /> Equipe
                </p>
                <p className="text-sm text-fg">{u.equipe}</p>
              </div>
              <div>
                <p className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-fg-dim">
                  <Users className="h-2.5 w-2.5" /> Clientes
                </p>
                <p className="text-sm text-fg">{u.clientes}</p>
              </div>
            </div>
          </div>
        ))}
      </section>

      <p className="flex items-start gap-2 text-[11px] text-fg-subtle">
        <CircleDollarSign className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
        <span>
          O faturamento aqui segue a mesma regra do financeiro de cada loja: crédito da casa
          não entra, porque o dinheiro entrou antes, fora do caixa.
        </span>
      </p>

      <Link href="/admin/lojas" className="btn-secondary text-xs">
        <span>Cuidar das unidades</span>
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
