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
import { resumoDaAusencia, linkWhatsApp, type ClienteSumido } from '@/lib/clientes-sumidos';
import { formatCurrency } from '@/lib/utils';
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
        <div className="card overflow-hidden">
          <div className="divide-y divide-border/40">
            {daPagina.map((c) => {
              const zap = linkWhatsApp(c, nomeBarbearia);

              return (
                <div
                  key={c.id}
                  className={`p-4 flex items-start justify-between gap-4 flex-wrap ${
                    c.contatadoEm ? 'opacity-60' : ''
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        href={`/admin/clientes/${c.id}`}
                        className="text-base text-fg hover:text-gold transition-colors"
                      >
                        {c.nome}
                      </Link>

                      {c.atraso >= 3 && !c.contatadoEm && (
                        <span className="text-[10px] px-2 py-0.5 rounded-md border border-danger/40 bg-danger/10 text-danger">
                          sumido faz tempo
                        </span>
                      )}

                      {c.contatadoEm && (
                        <span className="text-[10px] px-2 py-0.5 rounded-md border border-success/40 bg-success/10 text-success">
                          já chamado
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-fg-muted mt-1 flex items-center gap-1.5 flex-wrap">
                      <Clock className="w-3.5 h-3.5" />
                      Não vem {resumoDaAusencia(c)}
                      {c.ritmoDias ? ` · vinha a cada ${c.ritmoDias} dias` : ' · veio poucas vezes'}
                      {c.servicoHabitual ? ` · costuma fazer ${c.servicoHabitual}` : ''}
                    </p>

                    <p className="text-xs text-fg-subtle mt-1">
                      {c.visitas} {c.visitas === 1 ? 'visita' : 'visitas'} ·{' '}
                      {formatCurrency(c.totalGasto)} no total
                      {c.telefone ? (
                        <span className="inline-flex items-center gap-1 ml-2">
                          <Phone className="w-3 h-3" />
                          {c.telefone}
                        </span>
                      ) : (
                        <span className="ml-2 text-warn">sem telefone cadastrado</span>
                      )}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {zap && (
                      <a
                        href={zap}
                        target="_blank"
                        rel="noreferrer"
                        className="btn-gold-outline text-xs"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        Chamar
                      </a>
                    )}

                    {c.contatadoEm ? (
                      <button
                        type="button"
                        onClick={() => desfazer(c)}
                        disabled={ocupado === c.id}
                        className="btn-ghost text-xs"
                        title="Voltar para a fila de quem chamar"
                      >
                        {ocupado === c.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Undo2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => marcar(c)}
                        disabled={ocupado === c.id}
                        className="btn-secondary text-xs"
                        title="Marcar que já falei com este cliente"
                      >
                        {ocupado === c.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Check className="w-3.5 h-3.5" />
                        )}
                        Já falei
                      </button>
                    )}
                  </div>
                </div>
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
        </div>
      )}
    </div>
  );
}
