'use client';

import { useState } from 'react';
import { PiggyBank, Info, ChevronDown, ChevronUp } from 'lucide-react';
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
  return new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

export function SobrasSection({ sobras, fechados }: SobrasSectionProps) {
  const [aba, setAba] = useState<'aberto' | 'fechado'>('aberto');

  const totalEmAberto = sobras.reduce((s, x) => s + x.sobra, 0);
  const comSobra = sobras.filter((s) => s.sobra > 0);

  const fechadosComSobra = fechados.filter((f) => f.leftover_amount > 0);
  const totalFechado = fechadosComSobra.reduce((s, x) => s + x.leftover_amount, 0);

  return (
    <section className="card p-6 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2
            className="text-lg font-semibold text-fg flex items-center gap-2"
            style={{ fontFamily: 'var(--font-playfair), serif' }}
          >
            <PiggyBank className="w-5 h-5 text-gold" />
            Sobra das assinaturas
          </h2>
          <p className="text-xs text-fg-muted mt-1">
            O que o cliente pagou e não usou. Cada atendimento incluso vale uma fatia da parte dos
            barbeiros, então o que não foi usado ainda não tem dono.
          </p>
        </div>

        <div className="text-right">
          <p className="text-[9px] uppercase tracking-wider text-fg-dim">
            {aba === 'aberto' ? 'Sobra prevista nos ciclos abertos' : 'Sobra já apurada'}
          </p>
          <p
            className="text-2xl font-bold text-gold leading-none"
            style={{ fontFamily: 'var(--font-playfair), serif' }}
          >
            {formatCurrency(aba === 'aberto' ? totalEmAberto : totalFechado)}
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setAba('aberto')}
          className={aba === 'aberto' ? 'btn-gold-outline text-xs' : 'btn-ghost text-xs'}
        >
          Ciclos em aberto ({comSobra.length})
        </button>
        <button
          type="button"
          onClick={() => setAba('fechado')}
          className={aba === 'fechado' ? 'btn-gold-outline text-xs' : 'btn-ghost text-xs'}
        >
          Já fechados ({fechadosComSobra.length})
        </button>
      </div>

      {aba === 'aberto' ? (
        comSobra.length === 0 ? (
          <p className="text-sm text-fg-muted py-6 text-center">
            Nenhuma sobra por enquanto. Todo assinante usou o que o plano inclui.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-fg-dim border-b border-border/60">
                  <th className="text-left py-2 font-medium">Cliente</th>
                  <th className="text-center py-2 font-medium">Usou</th>
                  <th className="text-right py-2 font-medium">Vale cada</th>
                  <th className="text-right py-2 font-medium">A repassar</th>
                  <th className="text-right py-2 font-medium">Sobra</th>
                  <th className="text-right py-2 font-medium">Ciclo até</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {comSobra.map((s) => (
                  <tr key={s.assinaturaId}>
                    <td className="py-2.5">
                      <span className="text-fg">{s.cliente}</span>
                      <span className="block text-[10px] text-fg-dim">
                        {s.plano}
                        {s.vencida ? ' · ciclo vencido' : ''}
                      </span>
                    </td>
                    <td className="text-center text-fg-muted">
                      {s.usados} de {s.inclusos}
                    </td>
                    <td className="text-right text-fg-muted">{formatCurrency(s.valorPorUso)}</td>
                    <td className="text-right text-fg">{formatCurrency(s.aRepassar)}</td>
                    <td className="text-right font-semibold text-gold">
                      {formatCurrency(s.sobra)}
                    </td>
                    <td className="text-right text-[11px] text-fg-dim">{data(s.fimDoCiclo)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : fechadosComSobra.length === 0 ? (
        <p className="text-sm text-fg-muted py-6 text-center">
          Nenhum ciclo fechado com sobra ainda. A sobra aparece aqui quando você lança o pagamento
          da assinatura.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-fg-dim border-b border-border/60">
                <th className="text-left py-2 font-medium">Cliente</th>
                <th className="text-left py-2 font-medium">Ciclo</th>
                <th className="text-center py-2 font-medium">Não usou</th>
                <th className="text-left py-2 font-medium">Destino</th>
                <th className="text-right py-2 font-medium">Sobrou</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {fechadosComSobra.map((f) => (
                <tr key={f.id}>
                  <td className="py-2.5 text-fg">{f.customer_name}</td>
                  <td className="text-[11px] text-fg-dim">
                    {data(f.period_start)} a {data(f.period_end)}
                  </td>
                  <td className="text-center text-fg-muted">
                    {f.unused_uses} de {f.included_uses}
                  </td>
                  <td className="text-[11px] text-fg-muted">
                    {DESTINO_SOBRA_INFO[lerDestinoSobra(f.leftover_destination)].label}
                  </td>
                  <td className="text-right font-semibold text-gold">
                    {formatCurrency(f.leftover_amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-fg-subtle flex gap-2">
        <Info className="w-4 h-4 text-gold shrink-0 mt-0.5" />
        A sobra em aberto ainda pode diminuir: se o cliente vier de novo antes do fim do ciclo,
        aquele atendimento passa a ter dono. O valor só fica definitivo quando você lança o
        pagamento da assinatura.
      </p>
    </section>
  );
}
