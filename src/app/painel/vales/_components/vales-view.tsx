'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Plus, X, Clock, Check, Ban } from 'lucide-react';
import { pedirVale, cancelarMeuPedidoDeVale } from '../actions';
import { formatCurrency } from '@/lib/utils';

interface Vale {
  id: string;
  valor: number;
  motivo: string | null;
  status: string;
  pedidoEm: string;
  respondidoEm: string | null;
  observacaoDaGestao: string | null;
}

interface ValesViewProps {
  vales: Vale[];
  podePedir: boolean;
  totalDescontadoNoMes: number;
  saldoPrevisto: number | null;
}

const STATUS_INFO: Record<string, { label: string; classe: string; icon: typeof Clock }> = {
  pending: {
    label: 'Aguardando resposta',
    classe: 'text-warn border-warn/40 bg-warn/10',
    icon: Clock,
  },
  approved: {
    label: 'Aprovado',
    classe: 'text-success border-success/40 bg-success/10',
    icon: Check,
  },
  rejected: {
    label: 'Recusado',
    classe: 'text-danger border-danger/40 bg-danger/10',
    icon: Ban,
  },
};

function data(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

export function ValesView({
  vales,
  podePedir,
  totalDescontadoNoMes,
  saldoPrevisto,
}: ValesViewProps) {
  const router = useRouter();
  const [abrindo, setAbrindo] = useState(false);
  const [valor, setValor] = useState('');
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [cancelando, setCancelando] = useState<string | null>(null);

  const temPendente = vales.some((v) => v.status === 'pending');
  const valorNumero = Number(valor.replace(',', '.'));
  const passaDoSaldo =
    saldoPrevisto !== null && Number.isFinite(valorNumero) && valorNumero > saldoPrevisto;

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    try {
      const res = await pedirVale({ valor: valorNumero, motivo });
      if (res.ok) {
        toast.success('Pedido enviado. A gestão vai responder.');
        setValor('');
        setMotivo('');
        setAbrindo(false);
        router.refresh();
      } else {
        toast.error(res.error ?? 'Não foi possível pedir o vale.');
      }
    } finally {
      setEnviando(false);
    }
  }

  async function cancelar(id: string) {
    setCancelando(id);
    try {
      const res = await cancelarMeuPedidoDeVale(id);
      if (res.ok) {
        toast.success('Pedido cancelado.');
        router.refresh();
      } else {
        toast.error(res.error ?? 'Não foi possível cancelar.');
      }
    } finally {
      setCancelando(null);
    }
  }

  return (
    <div className="space-y-4">
      <section className="card p-5">
        <p className="text-xs text-fg-muted">Descontado neste mês</p>
        <p className="text-2xl font-bold text-fg">{formatCurrency(totalDescontadoNoMes)}</p>
        {saldoPrevisto !== null && (
          <p className="text-xs text-fg-subtle mt-1">
            Seu saldo previsto a receber é de {formatCurrency(saldoPrevisto)}.
          </p>
        )}
      </section>

      {podePedir && (
        <>
          {!abrindo ? (
            <button
              type="button"
              onClick={() => setAbrindo(true)}
              disabled={temPendente}
              className="btn-primary w-full"
            >
              <Plus className="w-4 h-4" />
              {temPendente ? 'Você já tem um pedido em aberto' : 'Pedir vale'}
            </button>
          ) : (
            <form onSubmit={enviar} className="card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-fg">Pedir vale</h2>
                <button
                  type="button"
                  onClick={() => setAbrindo(false)}
                  className="text-fg-muted hover:text-fg"
                  aria-label="Fechar"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div>
                <label className="label">Valor</label>
                <input
                  type="text"
                  inputMode="decimal"
                  className="input"
                  placeholder="150,00"
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                  required
                />
                {passaDoSaldo && (
                  <p className="text-xs text-warn mt-1">
                    Esse valor passa do seu saldo previsto. Você pode pedir mesmo assim, quem decide
                    é a gestão.
                  </p>
                )}
              </div>

              <div>
                <label className="label">Motivo</label>
                <input
                  type="text"
                  className="input"
                  placeholder="Ex.: adiantamento para material"
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  maxLength={300}
                  required
                />
              </div>

              <button type="submit" disabled={enviando} className="btn-primary w-full">
                {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Enviar pedido
              </button>
            </form>
          )}
        </>
      )}

      {vales.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-sm text-fg-muted">Você ainda não tem nenhum vale.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {vales.map((v) => {
            const info = STATUS_INFO[v.status] ?? {
              label: v.status,
              classe: 'text-fg-muted border-border bg-bg-elevated',
              icon: Clock,
            };
            const Icon = info.icon;

            return (
              <article key={v.id} className="card p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-bold text-fg">{formatCurrency(v.valor)}</p>
                    {v.motivo && <p className="text-sm text-fg-muted">{v.motivo}</p>}
                  </div>
                  <span
                    className={`text-[10px] px-2 py-1 rounded-md border flex items-center gap-1 shrink-0 ${info.classe}`}
                  >
                    <Icon className="w-3 h-3" />
                    {info.label}
                  </span>
                </div>

                <p className="text-xs text-fg-subtle">
                  Pedido em {data(v.pedidoEm)}
                  {v.respondidoEm ? ` · respondido em ${data(v.respondidoEm)}` : ''}
                </p>

                {v.observacaoDaGestao && (
                  <p className="text-xs text-fg-muted italic">{v.observacaoDaGestao}</p>
                )}

                {v.status === 'pending' && podePedir && (
                  <button
                    type="button"
                    onClick={() => cancelar(v.id)}
                    disabled={cancelando === v.id}
                    className="btn-ghost text-xs"
                  >
                    {cancelando === v.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <X className="w-3.5 h-3.5" />
                    )}
                    Cancelar pedido
                  </button>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
