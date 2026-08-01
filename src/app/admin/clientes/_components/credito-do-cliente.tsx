'use client';

/**
 * Credito do cliente na ficha dele.
 *
 * Mostra o saldo grande, porque e a pergunta que o balcao faz ("quanto ele ainda
 * tem?"), e embaixo o historico de cada concessao com a validade. Dar credito
 * novo fica escondido atras de um botao: e coisa rara, nao pode competir por
 * atencao com o que se olha todo dia.
 */

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Wallet, Plus, X, Ban } from 'lucide-react';
import { concederCredito, cancelarCredito } from '../actions';
import {
  situacaoDoCredito,
  saldoDoCredito,
  saldoDisponivel,
  rotuloSituacao,
  avisoDeVencimento,
  hojeNaBarbearia,
  type Credito,
} from '@/lib/credito-cliente';

interface Props {
  clienteId: string;
  nome: string;
  creditos: Credito[];
}

function reais(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function dataCurta(iso: string) {
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}

const CORES: Record<string, string> = {
  disponivel: 'text-emerald-400',
  ainda_nao_comecou: 'text-sky-400',
  vencido: 'text-fg-dim',
  esgotado: 'text-fg-dim',
  cancelado: 'text-fg-dim',
};

export function CreditoDoCliente({ clienteId, nome, creditos }: Props) {
  const router = useRouter();
  const [salvando, iniciar] = useTransition();
  const [abrindo, setAbrindo] = useState(false);
  const hoje = hojeNaBarbearia();

  const saldo = saldoDisponivel(creditos, hoje);

  function novoCredito(form: FormData) {
    const vencimento = String(form.get('vencimento') ?? '');
    iniciar(async () => {
      const r = await concederCredito({
        customerId: clienteId,
        valor: Number(String(form.get('valor') ?? '').replace(',', '.')),
        motivo: String(form.get('motivo') ?? ''),
        inicio: String(form.get('inicio') ?? ''),
        vencimento: vencimento || null,
      });
      if (!r.ok) {
        toast.error(r.error ?? 'Não consegui salvar o crédito.');
        return;
      }
      toast.success('Crédito lançado.');
      setAbrindo(false);
      router.refresh();
    });
  }

  function cancelar(creditoId: string) {
    const motivo = window.prompt('Por que está cancelando este crédito?');
    if (motivo === null) return;
    iniciar(async () => {
      const r = await cancelarCredito(creditoId, motivo);
      if (!r.ok) {
        toast.error(r.error ?? 'Não consegui cancelar.');
        return;
      }
      toast.success('Crédito cancelado.');
      router.refresh();
    });
  }

  return (
    <section className="card space-y-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.25em] text-fg-dim">Crédito na casa</p>
          <p className={`mt-1 text-2xl font-semibold ${saldo > 0 ? 'text-emerald-400' : 'text-fg-dim'}`}>
            {reais(saldo)}
          </p>
          <p className="mt-1 text-[11px] text-fg-subtle">
            {saldo > 0
              ? `${nome.split(' ')[0]} pode pagar com este saldo ao fechar a comanda.`
              : 'Sem saldo para usar hoje.'}
          </p>
        </div>

        {!abrindo && (
          <button
            type="button"
            onClick={() => setAbrindo(true)}
            className="btn-gold-outline shrink-0 text-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            Dar crédito
          </button>
        )}
      </div>

      {abrindo && (
        <form action={novoCredito} className="space-y-3 rounded-lg border border-line bg-surface-2 p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-fg">Novo crédito</p>
            <button
              type="button"
              onClick={() => setAbrindo(false)}
              className="text-fg-dim hover:text-fg"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block">
              <span className="text-[11px] text-fg-muted">Valor (R$)</span>
              <input
                name="valor"
                inputMode="decimal"
                required
                placeholder="1000,00"
                className="input mt-1 w-full"
              />
            </label>
            <label className="block">
              <span className="text-[11px] text-fg-muted">Vale a partir de</span>
              <input
                name="inicio"
                type="date"
                required
                defaultValue={hoje}
                className="input mt-1 w-full"
              />
            </label>
            <label className="block">
              <span className="text-[11px] text-fg-muted">Vence em</span>
              <input name="vencimento" type="date" className="input mt-1 w-full" />
            </label>
          </div>

          <label className="block">
            <span className="text-[11px] text-fg-muted">Motivo</span>
            <input
              name="motivo"
              required
              placeholder="Permuta: desenvolvimento do sistema"
              className="input mt-1 w-full"
            />
          </label>

          <p className="text-[11px] text-fg-subtle">
            Deixe o vencimento em branco se o crédito não tiver prazo. O que for pago com crédito
            não entra no caixa nem no DRE.
          </p>

          <button type="submit" disabled={salvando} className="btn-gold w-full text-xs">
            {salvando ? 'Salvando...' : 'Lançar crédito'}
          </button>
        </form>
      )}

      {creditos.length > 0 && (
        <ul className="space-y-2">
          {creditos.map((c) => {
            const situacao = situacaoDoCredito(c, hoje);
            const aviso = avisoDeVencimento(c, hoje);
            return (
              <li
                key={c.id}
                className="flex items-start justify-between gap-3 rounded-lg border border-line bg-surface-2 px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-sm text-fg">
                    <Wallet className="h-3.5 w-3.5 text-fg-dim" />
                    <span className="font-medium">{reais(saldoDoCredito(c))}</span>
                    <span className="text-[11px] text-fg-dim">de {reais(c.amount)}</span>
                    <span className={`text-[11px] ${CORES[situacao]}`}>
                      {rotuloSituacao(situacao)}
                      {aviso ? ` · ${aviso}` : ''}
                    </span>
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-fg-subtle">
                    {c.reason ?? 'Sem motivo anotado'} · de {dataCurta(c.startsAt)}
                    {c.expiresAt ? ` até ${dataCurta(c.expiresAt)}` : ' sem prazo'}
                  </p>
                </div>

                {!c.cancelledAt && (
                  <button
                    type="button"
                    onClick={() => cancelar(c.id)}
                    disabled={salvando}
                    className="btn-ghost shrink-0 text-[11px]"
                    title="Cancelar este crédito"
                  >
                    <Ban className="h-3.5 w-3.5" />
                    Cancelar
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
