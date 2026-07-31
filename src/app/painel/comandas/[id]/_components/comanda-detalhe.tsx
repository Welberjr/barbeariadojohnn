'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Loader2,
  Plus,
  Trash2,
  Scissors,
  Package,
  CreditCard,
  Crown,
  RotateCcw,
  XCircle,
} from 'lucide-react';

import {
  lancarServico,
  lancarProduto,
  removerItem,
  fecharMinhaComanda,
  reabrirMinhaComanda,
  cancelarMinhaComanda,
} from '../../actions';
import { formatCurrency } from '@/lib/utils';
import { corDoSelo, type Selo } from '@/lib/painel/assinatura-selo';
import {
  calcularFechamento,
  JANELA_CORRECAO_MINUTOS,
  type MetodoPagamento,
} from '@/lib/painel/comanda-calculo';

interface Item {
  id: string;
  nome: string;
  tipo: string;
  quantidade: number;
  total: number;
  coberto: boolean;
  meu: boolean;
}

interface Opcao {
  id: string;
  nome: string;
  preco: number;
}

interface ComandaDetalheProps {
  comandaId: string;
  cliente: string;
  aberta: boolean;
  /** Cancelada antes de virar dinheiro: nao tem o que corrigir nem estornar */
  cancelada?: boolean;
  /** Quando foi fechada, para saber se ainda dá tempo de corrigir */
  fechadaEm?: string | null;
  itens: Item[];
  subtotal: number;
  servicos: Opcao[];
  produtos: Opcao[];
  selo: Selo;
  taxaCredito: number;
  taxaDebito: number;
}

const METODOS: Array<{ valor: MetodoPagamento; label: string }> = [
  { valor: 'pix', label: 'PIX' },
  { valor: 'cash', label: 'Dinheiro' },
  { valor: 'debit', label: 'Débito' },
  { valor: 'credit', label: 'Crédito' },
];

export function ComandaDetalhe({
  comandaId,
  cliente,
  aberta,
  cancelada = false,
  fechadaEm,
  itens,
  subtotal,
  servicos,
  produtos,
  selo,
  taxaCredito,
  taxaDebito,
}: ComandaDetalheProps) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [confirmandoCorrecao, setConfirmandoCorrecao] = useState(false);
  const [confirmandoCancelar, setConfirmandoCancelar] = useState(false);
  const [motivoCancelar, setMotivoCancelar] = useState('');

  // Minutos que ainda restam da janela de correção. Calculado no navegador
  // para o contador não nascer errado por causa do cache da página.
  const [minutosRestantes, setMinutosRestantes] = useState<number | null>(null);

  useEffect(() => {
    if (aberta || !fechadaEm) {
      setMinutosRestantes(null);
      return;
    }
    const calcular = () => {
      const passados = (Date.now() - new Date(fechadaEm).getTime()) / 60000;
      setMinutosRestantes(Math.max(0, Math.ceil(JANELA_CORRECAO_MINUTOS - passados)));
    };
    calcular();
    const t = setInterval(calcular, 30000);
    return () => clearInterval(t);
  }, [aberta, fechadaEm]);
  const [aba, setAba] = useState<'servico' | 'produto'>('servico');
  const [metodo, setMetodo] = useState<MetodoPagamento>('pix');
  const [confirmandoFechar, setConfirmandoFechar] = useState(false);

  const temItemDeOutro = itens.some((i) => !i.meu);

  const conta = calcularFechamento({
    subtotal,
    metodo,
    taxaCreditoPercent: taxaCredito,
    taxaDebitoPercent: taxaDebito,
  });

  async function executar(chave: string, fn: () => Promise<{ ok: boolean; error?: string }>) {
    if (ocupado) return;
    setOcupado(chave);
    try {
      const res = await fn();
      if (res.ok) {
        router.refresh();
      } else {
        toast.error(res.error ?? 'Não foi possível.');
      }
      return res;
    } finally {
      setOcupado(null);
    }
  }

  async function corrigir() {
    const res = await executar('corrigir', () => reabrirMinhaComanda(comandaId));
    if (res?.ok) {
      toast.success('Comanda reaberta. Corrija e feche de novo.');
      setConfirmandoCorrecao(false);
    }
  }

  async function fechar() {
    const res = await executar('fechar', () =>
      fecharMinhaComanda({ comandaId, metodo })
    );
    if (res?.ok) {
      toast.success('Comanda fechada.');
      router.push('/painel/comandas');
    }
  }

  async function cancelar() {
    const res = await executar('cancelar', () =>
      cancelarMinhaComanda(comandaId, motivoCancelar)
    );
    if (res?.ok) {
      toast.success('Comanda cancelada.');
      router.push('/painel/comandas');
    }
  }

  return (
    <div className="space-y-5">
      {/* Cliente e assinatura */}
      <section className="card p-5 space-y-2">
        <p className="text-lg text-fg">{cliente}</p>
        {selo.situacao !== 'sem_assinatura' && (
          <span
            className={`inline-block text-xs px-2 py-1 rounded-md border ${corDoSelo(
              selo.situacao
            )}`}
          >
            {selo.texto}
          </span>
        )}
      </section>

      {/* Itens */}
      <section className="space-y-3">
        <p className="text-[10px] text-fg-dim tracking-[0.25em] uppercase">Itens</p>

        {itens.length === 0 ? (
          <div className="card p-6 text-center">
            <p className="text-sm text-fg-muted">Nenhum item lançado ainda.</p>
          </div>
        ) : (
          itens.map((item) => (
            <div key={item.id} className="card p-4 flex items-center justify-between gap-3">
              <span className="min-w-0">
                <span className="block text-sm text-fg truncate">
                  {item.nome}
                  {item.quantidade > 1 ? ` (${item.quantidade}x)` : ''}
                </span>
                {!item.meu && (
                  <span className="block text-[10px] text-warn">
                    Lançado por outro profissional
                  </span>
                )}
              </span>

              <span className="flex items-center gap-3 shrink-0">
                <span className={`text-sm ${item.coberto ? 'text-success' : 'text-fg'}`}>
                  {item.coberto ? 'Assinatura' : formatCurrency(item.total)}
                </span>

                {aberta && item.meu && (
                  <button
                    type="button"
                    onClick={() => executar(`rm:${item.id}`, () => removerItem(comandaId, item.id))}
                    disabled={!!ocupado}
                    className="text-fg-muted hover:text-danger transition-colors"
                    aria-label="Remover item"
                  >
                    {ocupado === `rm:${item.id}` ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                )}
              </span>
            </div>
          ))
        )}
      </section>

      {aberta && (
        <>
          {/* Lançar item */}
          <section className="card p-5 space-y-4">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setAba('servico')}
                className={aba === 'servico' ? 'btn-gold-outline text-xs' : 'btn-ghost text-xs'}
              >
                <Scissors className="w-3.5 h-3.5" />
                Serviço
              </button>
              <button
                type="button"
                onClick={() => setAba('produto')}
                className={aba === 'produto' ? 'btn-gold-outline text-xs' : 'btn-ghost text-xs'}
              >
                <Package className="w-3.5 h-3.5" />
                Produto
              </button>
            </div>

            <div className="space-y-2">
              {(aba === 'servico' ? servicos : produtos).map((opcao) => (
                <div
                  key={opcao.id}
                  className="flex items-center justify-between gap-2 p-3 rounded-md border border-border"
                >
                  <span className="min-w-0">
                    <span className="block text-sm text-fg truncate">{opcao.nome}</span>
                    <span className="block text-xs text-fg-muted">
                      {formatCurrency(opcao.preco)}
                    </span>
                  </span>

                  <span className="flex items-center gap-2 shrink-0">
                    {aba === 'servico' && selo.cobre && (
                      <button
                        type="button"
                        onClick={() =>
                          executar(`assin:${opcao.id}`, () =>
                            lancarServico({
                              comandaId,
                              serviceId: opcao.id,
                              usarAssinatura: true,
                            })
                          )
                        }
                        disabled={!!ocupado}
                        className="btn-secondary text-xs"
                      >
                        {ocupado === `assin:${opcao.id}` ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Crown className="w-3.5 h-3.5" />
                        )}
                        Assinatura
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() =>
                        executar(`add:${opcao.id}`, () =>
                          aba === 'servico'
                            ? lancarServico({
                                comandaId,
                                serviceId: opcao.id,
                                usarAssinatura: false,
                              })
                            : lancarProduto({
                                comandaId,
                                productId: opcao.id,
                                quantidade: 1,
                              })
                        )
                      }
                      disabled={!!ocupado}
                      className="btn-gold-outline text-xs"
                    >
                      {ocupado === `add:${opcao.id}` ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Plus className="w-3.5 h-3.5" />
                      )}
                      Lançar
                    </button>
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* Fechamento */}
          <section className="card p-5 space-y-4">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-fg-muted">Total</span>
              <span className="text-2xl font-bold text-gold">{formatCurrency(conta.total)}</span>
            </div>

            <div>
              <p className="text-[10px] text-fg-dim tracking-[0.25em] uppercase mb-2">
                Forma de pagamento
              </p>
              <div className="grid grid-cols-2 gap-2">
                {METODOS.map((m) => (
                  <button
                    key={m.valor}
                    type="button"
                    onClick={() => setMetodo(m.valor)}
                    className={
                      metodo === m.valor ? 'btn-gold-outline text-xs' : 'btn-secondary text-xs'
                    }
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {conta.taxaValor > 0 && (
              <p className="text-xs text-fg-subtle">
                Taxa do cartão: {formatCurrency(conta.taxaValor)}. Entra para a barbearia
                {formatCurrency(conta.liquido)}.
              </p>
            )}

            {temItemDeOutro ? (
              <p className="text-xs text-warn">
                Esta comanda tem item de outro profissional. Peça para a gestão fechar, para a
                comissão sair certa.
              </p>
            ) : !confirmandoFechar ? (
              <button
                type="button"
                onClick={() => setConfirmandoFechar(true)}
                disabled={itens.length === 0}
                className="btn-primary w-full"
              >
                <CreditCard className="w-4 h-4" />
                Fechar comanda
              </button>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-fg">
                  Fechar {formatCurrency(conta.total)} em{' '}
                  {METODOS.find((m) => m.valor === metodo)?.label}?
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={fechar}
                    disabled={!!ocupado}
                    className="btn-primary flex-1"
                  >
                    {ocupado === 'fechar' ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CreditCard className="w-4 h-4" />
                    )}
                    Confirmar
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmandoFechar(false)}
                    className="btn-secondary flex-1"
                  >
                    Voltar
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* Cancelar: o cliente foi embora antes de ser atendido */}
          <section className="card p-5 space-y-3">
            {!confirmandoCancelar ? (
              <>
                <p className="text-xs text-fg-muted">
                  O cliente foi embora e não vai ser atendido? Cancele a comanda em vez de
                  lançar alguma coisa só para poder fechar.
                </p>
                <button
                  type="button"
                  onClick={() => setConfirmandoCancelar(true)}
                  className="btn-ghost w-full text-xs text-danger hover:text-danger"
                >
                  <XCircle className="w-4 h-4" />
                  Cancelar esta comanda
                </button>
              </>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-fg">Cancelar a comanda de {cliente}?</p>

                {itens.length > 0 && (
                  <p className="text-xs text-warn">
                    Os {itens.length} {itens.length === 1 ? 'item lançado sai' : 'itens lançados saem'}{' '}
                    da comanda. Produto volta para o estoque e uso de assinatura volta para o
                    cliente.
                  </p>
                )}

                <input
                  type="text"
                  className="input"
                  placeholder="Motivo (o cliente precisou sair, desistiu...)"
                  value={motivoCancelar}
                  onChange={(e) => setMotivoCancelar(e.target.value)}
                  maxLength={120}
                />

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={cancelar}
                    disabled={!!ocupado}
                    className="btn-secondary flex-1 text-danger"
                  >
                    {ocupado === 'cancelar' ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <XCircle className="w-4 h-4" />
                    )}
                    Cancelar comanda
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmandoCancelar(false)}
                    className="btn-primary flex-1"
                  >
                    Voltar
                  </button>
                </div>
              </div>
            )}
          </section>
        </>
      )}

      {!aberta && cancelada && (
        <section className="card p-5">
          <p className="text-sm text-fg-muted">
            Comanda cancelada. Nada foi cobrado do cliente. Se ele voltar, abra uma comanda
            nova.
          </p>
        </section>
      )}

      {!aberta && !cancelada && (
        <section className="card p-5 space-y-3">
          {minutosRestantes !== null && minutosRestantes > 0 ? (
            <>
              <p className="text-sm text-fg">
                Comanda fechada. Errou alguma coisa? Dá para corrigir por{' '}
                <span className="text-gold font-medium">
                  mais {minutosRestantes} {minutosRestantes === 1 ? 'minuto' : 'minutos'}
                </span>
                .
              </p>
              <p className="text-xs text-fg-muted">
                Ao corrigir, a comanda volta a ficar aberta: o pagamento é desfeito e você lança de
                novo do jeito certo.
              </p>

              {!confirmandoCorrecao ? (
                <button
                  type="button"
                  onClick={() => setConfirmandoCorrecao(true)}
                  className="btn-gold-outline w-full"
                >
                  <RotateCcw className="w-4 h-4" />
                  Corrigir esta comanda
                </button>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-fg">
                    Reabrir a comanda para corrigir?
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={corrigir}
                      disabled={!!ocupado}
                      className="btn-primary flex-1"
                    >
                      {ocupado === 'corrigir' ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <RotateCcw className="w-4 h-4" />
                      )}
                      Reabrir
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmandoCorrecao(false)}
                      className="btn-secondary flex-1"
                    >
                      Voltar
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-fg-muted">
              Comanda fechada há mais de uma hora. Para corrigir agora, peça para a gestão estornar.
            </p>
          )}
        </section>
      )}
    </div>
  );
}
