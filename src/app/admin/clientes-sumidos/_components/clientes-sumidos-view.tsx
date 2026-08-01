'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  MessageCircle,
  Check,
  Undo2,
  Loader2,
  Phone,
  Clock,
  Search,
} from 'lucide-react';

import { marcarContatoFeito, desfazerContato } from '../actions';
import {
  resumoDaAusencia,
  ritmoEmPalavras,
  linkWhatsApp,
  type ClienteSumido,
} from '@/lib/clientes-sumidos';
import { formatCurrency, formatPhone } from '@/lib/utils';
import { Paginacao } from '@/components/paginacao';

const POR_PAGINA = 12;

const FAIXAS = [
  { dias: 30, rotulo: 'Some há 30 dias' },
  { dias: 45, rotulo: '45 dias' },
  { dias: 60, rotulo: '60 dias' },
  { dias: 90, rotulo: '90 dias' },
];

interface Props {
  clientes: ClienteSumido[];
  nomeBarbearia: string;
  padraoDias: number;
  totalAChamar: number;
  valorParado: number;
}

export function ClientesSumidosView({
  clientes,
  nomeBarbearia,
  padraoDias,
  totalAChamar,
  valorParado,
}: Props) {
  const router = useRouter();
  const [busca, setBusca] = useState('');
  const [pagina, setPagina] = useState(1);
  const [mostrarChamados, setMostrarChamados] = useState(false);
  const [ocupado, setOcupado] = useState<string | null>(null);

  const filtrados = clientes
    .filter((c) => (mostrarChamados ? true : !c.contatadoEm))
    .filter((c) =>
      busca.trim().length < 2
        ? true
        : c.nome.toLowerCase().includes(busca.toLowerCase()) ||
          (c.telefone ?? '').includes(busca.replace(/\D/g, ''))
    );

  const daPagina = filtrados.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);

  async function marcar(c: ClienteSumido) {
    setOcupado(c.id);
    try {
      const res = await marcarContatoFeito(c.id);
      if (res.ok) {
        toast.success(`${c.nome.split(' ')[0]} marcado como chamado.`);
        router.refresh();
      } else {
        toast.error(res.error ?? 'Não foi possível marcar.');
      }
    } finally {
      setOcupado(null);
    }
  }

  async function desfazer(c: ClienteSumido) {
    setOcupado(c.id);
    try {
      const res = await desfazerContato(c.id);
      if (res.ok) {
        toast.success('Voltou para a fila.');
        router.refresh();
      }
    } finally {
      setOcupado(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="card p-4">
          <p className="text-[10px] uppercase tracking-wider text-fg-dim">Para chamar</p>
          <p
            className="text-2xl font-bold text-gold"
            style={{ fontFamily: 'var(--font-playfair), serif' }}
          >
            {totalAChamar}
          </p>
          <p className="text-[11px] text-fg-subtle mt-1">clientes ainda não procurados</p>
        </div>

        <div className="card p-4">
          <p className="text-[10px] uppercase tracking-wider text-fg-dim">Já gastaram aqui</p>
          <p
            className="text-2xl font-bold text-fg"
            style={{ fontFamily: 'var(--font-playfair), serif' }}
          >
            {formatCurrency(valorParado)}
          </p>
          <p className="text-[11px] text-fg-subtle mt-1">
            é o histórico de quem parou de voltar
          </p>
        </div>

        <div className="card p-4">
          <p className="text-[10px] uppercase tracking-wider text-fg-dim mb-2">
            Cliente sem ritmo conhecido some depois de
          </p>
          <div className="flex flex-wrap gap-1">
            {FAIXAS.map((f) => (
              <Link
                key={f.dias}
                href={`/admin/clientes-sumidos?dias=${f.dias}`}
                className={
                  padraoDias === f.dias
                    ? 'btn-gold-outline text-[11px] px-2 py-1'
                    : 'btn-ghost text-[11px] px-2 py-1'
                }
              >
                {f.dias} dias
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-fg-dim absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            className="input pl-9"
            placeholder="Buscar por nome ou telefone"
            value={busca}
            onChange={(e) => {
              setBusca(e.target.value);
              setPagina(1);
            }}
          />
        </div>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            className="w-4 h-4 accent-gold"
            checked={mostrarChamados}
            onChange={(e) => {
              setMostrarChamados(e.target.checked);
              setPagina(1);
            }}
          />
          <span className="text-xs text-fg-muted">Mostrar quem já foi chamado</span>
        </label>
      </div>

      {/* Lista */}
      {filtrados.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-sm text-fg-muted">
            {clientes.length === 0
              ? 'Ninguém sumido por enquanto. Todo mundo está voltando no ritmo de sempre.'
              : 'Nenhum cliente com esse filtro.'}
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-3 lg:grid-cols-2">
            {daPagina.map((c) => {
              const zap = linkWhatsApp(c, nomeBarbearia);
              const ritmo = ritmoEmPalavras(c.ritmoDias);

              return (
                <article
                  key={c.id}
                  className={`card flex flex-col gap-3 p-4 ${c.contatadoEm ? 'opacity-60' : ''}`}
                >
                  {/* Quem é e há quanto tempo sumiu: o que decide se vale a pena chamar */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        href={`/admin/clientes/${c.id}`}
                        className="block truncate text-base capitalize text-fg transition-colors hover:text-gold"
                      >
                        {c.nome}
                      </Link>
                      <p className="mt-1 flex items-center gap-1.5 text-sm text-fg-muted">
                        <Clock className="h-3.5 w-3.5 shrink-0 text-fg-dim" />
                        Não vem {resumoDaAusencia(c)}
                      </p>
                    </div>

                    {/* Quanto ele passou do proprio ritmo. "Sumido faz tempo" em
                        todo mundo nao dizia nada: a lista inteira e de gente
                        sumida. O numero separa quem sumiu do quem sumiu MUITO. */}
                    {c.contatadoEm ? (
                      <span className="shrink-0 rounded-md border border-success/40 bg-success/10 px-2 py-0.5 text-[10px] text-success">
                        já chamado
                      </span>
                    ) : c.atraso >= 2 ? (
                      <span
                        className={`shrink-0 rounded-md border px-2 py-0.5 text-[10px] ${
                          c.atraso >= 4
                            ? 'border-danger/40 bg-danger/10 text-danger'
                            : 'border-warn/40 bg-warn/10 text-warn'
                        }`}
                        title="Quantas vezes o tempo normal dele já passou"
                      >
                        {/* Com teto: acima de dez, o numero exato nao muda
                            decisao nenhuma e so vira barulho na tela. */}
                        {c.atraso >= 10 ? 'mais de 10x' : `${Math.floor(c.atraso)}x`} o normal dele
                      </span>
                    ) : null}
                  </div>

                  {/* O que ele era para a casa */}
                  <div className="space-y-1 border-t border-border/40 pt-3 text-xs text-fg-muted">
                    <p>
                      {ritmo ?? 'veio poucas vezes'}
                      {c.servicoHabitual ? ` · costuma fazer ${c.servicoHabitual}` : ''}
                    </p>
                    <p>
                      {c.visitas} {c.visitas === 1 ? 'visita' : 'visitas'} ·{' '}
                      <span className="text-fg">{formatCurrency(c.totalGasto)}</span> no total
                    </p>
                    {c.telefone ? (
                      <p className="flex items-center gap-1.5">
                        <Phone className="h-3 w-3 shrink-0 text-fg-dim" />
                        {formatPhone(c.telefone)}
                      </p>
                    ) : (
                      <p className="text-warn">sem telefone cadastrado</p>
                    )}
                  </div>

                  {/* Ações embaixo, com espaço para o dedo */}
                  <div className="flex gap-2 border-t border-border/40 pt-3">
                    {zap ? (
                      <a
                        href={zap}
                        target="_blank"
                        rel="noreferrer"
                        className="btn-gold-outline flex-1 text-xs"
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                        Chamar
                      </a>
                    ) : (
                      <span className="flex-1 self-center text-[11px] text-fg-dim">
                        Sem WhatsApp para chamar
                      </span>
                    )}

                    {c.contatadoEm ? (
                      <button
                        type="button"
                        onClick={() => desfazer(c)}
                        disabled={ocupado === c.id}
                        className="btn-ghost flex-1 text-xs"
                        title="Voltar para a fila de quem chamar"
                      >
                        {ocupado === c.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Undo2 className="h-3.5 w-3.5" />
                        )}
                        Voltar para a fila
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => marcar(c)}
                        disabled={ocupado === c.id}
                        className="btn-secondary flex-1 text-xs"
                        title="Marcar que já falei com este cliente"
                      >
                        {ocupado === c.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Check className="h-3.5 w-3.5" />
                        )}
                        Já falei
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>

          <Paginacao
            paginaAtual={pagina}
            totalItens={filtrados.length}
            itensPorPagina={POR_PAGINA}
            aoMudar={setPagina}
            rotulo="clientes"
          />
        </>
      )}
    </div>
  );
}
