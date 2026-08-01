'use client';

/**
 * Sobra das assinaturas.
 *
 * Era uma tabela de seis colunas. No celular, que e onde o Johnn olha isso, as
 * colunas se espremiam a ponto de os titulos colarem uns nos outros ("vale a
 * cada repassar") e o resto ficava escondido atras de uma rolagem lateral que
 * ninguem percebe que existe.
 *
 * Agora e um cartao por cliente. Cada um responde tres perguntas na ordem em que
 * elas aparecem na cabeca de quem paga: quem e, quanto ele usou do que tem
 * direito, e quanto disso ainda nao tem dono. A sobra e o unico numero grande da
 * tela, porque e o unico que vira decisao.
 */

import { useState } from 'react';
import { PiggyBank, Info, CalendarClock, AlertTriangle } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { DESTINO_SOBRA_INFO, lerDestinoSobra } from '@/lib/subscriptions-rateio';

interface SobraEmAberto {
  assinaturaId: string;
  cliente: string;
  plano: string;
  usados: number;
  inclusos: number;
  naoUsados: number;
  valorPorUso: number;
  aRepassar: number;
  sobra: number;
  fimDoCiclo: string;
  vencida: boolean;
  destino: string;
}

interface CicloFechado {
  id: string;
  customer_name: string;
  period_start: string;
  period_end: string;
  total_uses: number;
  included_uses: number;
  unused_uses: number;
  leftover_amount: number;
  leftover_destination: string;
  pool_amount: number;
}

interface SobrasSectionProps {
  sobras: SobraEmAberto[];
  fechados: CicloFechado[];
}

function data(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
  });
}

/** Quanto do plano ja foi usado, em desenho. */
function BarraDeUso({ usados, inclusos }: { usados: number; inclusos: number }) {
  const proporcao = inclusos > 0 ? Math.min(1, usados / inclusos) : 0;

  return (
    <div className="flex items-center gap-2.5">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-bg-elevated">
        <div
          className="h-full rounded-full bg-gold/70 transition-all"
          style={{ width: `${proporcao * 100}%` }}
        />
      </div>
      <span className="shrink-0 text-xs text-fg-muted">
        usou <span className="text-fg">{usados}</span> de {inclusos}
      </span>
    </div>
  );
}

/** Uma linha de valor: nome do lado esquerdo, dinheiro do direito. */
function Linha({
  rotulo,
  valor,
  destaque = false,
}: {
  rotulo: string;
  valor: number;
  destaque?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className={destaque ? 'text-sm text-fg' : 'text-xs text-fg-muted'}>{rotulo}</span>
      <span
        className={
          destaque
            ? 'text-lg font-bold text-gold'
            : 'text-sm text-fg-muted tabular-nums'
        }
        style={destaque ? { fontFamily: 'var(--font-playfair), serif' } : undefined}
      >
        {formatCurrency(valor)}
      </span>
    </div>
  );
}

export function SobrasSection({ sobras, fechados }: SobrasSectionProps) {
  const [aba, setAba] = useState<'aberto' | 'fechado'>('aberto');

  const totalEmAberto = sobras.reduce((s, x) => s + x.sobra, 0);
  const comSobra = sobras.filter((s) => s.sobra > 0);

  const fechadosComSobra = fechados.filter((f) => f.leftover_amount > 0);
  const totalFechado = fechadosComSobra.reduce((s, x) => s + x.leftover_amount, 0);

  return (
    <section className="card space-y-5 p-5 sm:p-6">
      {/* Cabeçalho: o que é isto, e quanto dá no total */}
      <div>
        <h2
          className="flex items-center gap-2 text-lg font-semibold text-fg"
          style={{ fontFamily: 'var(--font-playfair), serif' }}
        >
          <PiggyBank className="h-5 w-5 text-gold" />
          Sobra das assinaturas
        </h2>
        <p className="mt-1 text-xs text-fg-muted">
          O que o cliente pagou e não usou. Cada atendimento incluso vale uma fatia da parte dos
          barbeiros, então o que não foi usado ainda não tem dono.
        </p>
      </div>

      <div className="rounded-lg border border-gold/20 bg-gold/5 px-4 py-3">
        <p className="text-[10px] uppercase tracking-wider text-fg-dim">
          {aba === 'aberto' ? 'Sobra prevista nos ciclos abertos' : 'Sobra já apurada'}
        </p>
        <p
          className="mt-0.5 text-3xl font-bold leading-none text-gold"
          style={{ fontFamily: 'var(--font-playfair), serif' }}
        >
          {formatCurrency(aba === 'aberto' ? totalEmAberto : totalFechado)}
        </p>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setAba('aberto')}
          className={aba === 'aberto' ? 'btn-gold-outline text-xs' : 'btn-ghost text-xs'}
        >
          Em aberto ({comSobra.length})
        </button>
        <button
          type="button"
          onClick={() => setAba('fechado')}
          className={aba === 'fechado' ? 'btn-gold-outline text-xs' : 'btn-ghost text-xs'}
        >
          Já fechados ({fechadosComSobra.length})
        </button>
      </div>

      {/* ── Ciclos em aberto ─────────────────────────────────────────── */}
      {aba === 'aberto' &&
        (comSobra.length === 0 ? (
          <p className="py-6 text-center text-sm text-fg-muted">
            Nenhuma sobra por enquanto. Todo assinante usou o que o plano inclui.
          </p>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {comSobra.map((s) => (
              <article
                key={s.assinaturaId}
                className="space-y-3 rounded-lg border border-border/60 bg-bg-elevated/40 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium capitalize text-fg">{s.cliente}</p>
                    <p className="mt-0.5 truncate text-[11px] uppercase tracking-wide text-fg-dim">
                      {s.plano}
                    </p>
                  </div>

                  <span
                    className={`flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-[10px] ${
                      s.vencida
                        ? 'border-warn/40 bg-warn/10 text-warn'
                        : 'border-border bg-bg text-fg-muted'
                    }`}
                  >
                    {s.vencida ? (
                      <AlertTriangle className="h-3 w-3" />
                    ) : (
                      <CalendarClock className="h-3 w-3" />
                    )}
                    {s.vencida ? 'ciclo vencido' : `até ${data(s.fimDoCiclo)}`}
                  </span>
                </div>

                <BarraDeUso usados={s.usados} inclusos={s.inclusos} />

                <div className="space-y-1.5 border-t border-border/40 pt-3">
                  <Linha rotulo="Vai para os barbeiros" valor={s.aRepassar} />
                  <Linha rotulo="Sobra" valor={s.sobra} destaque />
                </div>

                <p className="text-[11px] text-fg-subtle">
                  Cada atendimento do plano vale {formatCurrency(s.valorPorUso)}.{' '}
                  {s.naoUsados === 1
                    ? 'Falta 1 atendimento para o cliente usar tudo.'
                    : `Faltam ${s.naoUsados} atendimentos para o cliente usar tudo.`}
                </p>
              </article>
            ))}
          </div>
        ))}

      {/* ── Ciclos já fechados ───────────────────────────────────────── */}
      {aba === 'fechado' &&
        (fechadosComSobra.length === 0 ? (
          <p className="py-6 text-center text-sm text-fg-muted">
            Nenhum ciclo fechado com sobra ainda. A sobra aparece aqui quando você lança o
            pagamento da assinatura.
          </p>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {fechadosComSobra.map((f) => (
              <article
                key={f.id}
                className="space-y-3 rounded-lg border border-border/60 bg-bg-elevated/40 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 truncate text-sm font-medium capitalize text-fg">
                    {f.customer_name}
                  </p>
                  <span className="shrink-0 text-[10px] text-fg-dim">
                    {data(f.period_start)} a {data(f.period_end)}
                  </span>
                </div>

                <BarraDeUso usados={f.total_uses} inclusos={f.included_uses} />

                <div className="space-y-1.5 border-t border-border/40 pt-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-xs text-fg-muted">Ficou com</span>
                    <span className="text-xs text-fg">
                      {DESTINO_SOBRA_INFO[lerDestinoSobra(f.leftover_destination)].label}
                    </span>
                  </div>
                  <Linha rotulo="Sobrou" valor={f.leftover_amount} destaque />
                </div>

                <p className="text-[11px] text-fg-subtle">
                  Não usou {f.unused_uses} de {f.included_uses} deste ciclo.
                </p>
              </article>
            ))}
          </div>
        ))}

      <p className="flex gap-2 rounded-lg border border-border/40 bg-bg-elevated/30 p-3 text-xs text-fg-subtle">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
        <span>
          A sobra em aberto ainda pode diminuir: se o cliente vier de novo antes do fim do ciclo,
          aquele atendimento passa a ter dono. O valor só fica definitivo quando você lança o
          pagamento da assinatura.
        </span>
      </p>
    </section>
  );
}
