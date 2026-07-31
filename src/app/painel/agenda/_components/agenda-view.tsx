'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  ChevronLeft,
  ChevronRight,
  Check,
  Play,
  CircleCheck,
  UserX,
  CalendarOff,
  Loader2,
  Phone,
} from 'lucide-react';

import { mudarStatusAgendamento, bloquearMeuDia } from '../actions';
import {
  acoesDisponiveis,
  rotuloEstado,
  type AcaoAgenda,
  type StatusAgendamento,
} from '@/lib/painel/agenda-estados';
import { montarSelo, corDoSelo, type AssinaturaResumo } from '@/lib/painel/assinatura-selo';
import { useAcaoRapida } from '@/lib/use-acao-rapida';
import { EncaixarCliente } from './encaixar-cliente';

interface AgendamentoView {
  id: string;
  cliente: string;
  telefone: string | null;
  inicio: string;
  fim: string;
  status: string;
  servicos: string[];
  observacao: string | null;
  assinatura: AssinaturaResumo | null;
}

interface AgendaViewProps {
  data: string;
  agendamentos: AgendamentoView[];
  podeOperar: boolean;
  servicos: Array<{ id: string; nome: string; preco: number; minutos: number }>;
}

const ACAO_INFO: Record<AcaoAgenda, { label: string; icon: typeof Check }> = {
  confirmar: { label: 'Confirmar', icon: Check },
  iniciar: { label: 'Iniciar', icon: Play },
  concluir: { label: 'Concluir', icon: CircleCheck },
  falta: { label: 'Faltou', icon: UserX },
};

/** Para onde o card vai na tela assim que o barbeiro clica. */
const PROXIMO_STATUS: Record<AcaoAgenda, StatusAgendamento> = {
  confirmar: 'confirmed',
  iniciar: 'in_progress',
  concluir: 'completed',
  falta: 'no_show',
};

const ROTULO_SUCESSO: Record<AcaoAgenda, string> = {
  confirmar: 'Presença confirmada',
  iniciar: 'Atendimento iniciado',
  concluir: 'Atendimento concluído',
  falta: 'Marcado como falta',
};

function somarDias(dataStr: string, dias: number): string {
  const d = new Date(dataStr + 'T12:00:00');
  d.setDate(d.getDate() + dias);
  return d.toISOString().split('T')[0];
}

function hora(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  });
}

export function AgendaView({ data, agendamentos, podeOperar, servicos }: AgendaViewProps) {
  const router = useRouter();
  const [pendente, startTransition] = useTransition();
  const { executar: executarRapido } = useAcaoRapida();
  // Status mostrado na tela antes de o servidor confirmar. O card muda no
  // clique e volta sozinho se a gravação falhar.
  const [statusLocal, setStatusLocal] = useState<Record<string, StatusAgendamento>>({});
  const [bloqueando, setBloqueando] = useState(false);

  function irPara(novaData: string) {
    startTransition(() => router.push(`/painel/agenda?data=${novaData}`));
  }

  function executar(id: string, acao: AcaoAgenda, statusAtual: StatusAgendamento) {
    const proximo = PROXIMO_STATUS[acao];
    const anterior = statusLocal[id] ?? statusAtual;

    executarRapido({
      otimista: () => setStatusLocal((s) => ({ ...s, [id]: proximo })),
      desfazer: () => setStatusLocal((s) => ({ ...s, [id]: anterior })),
      acao: () => mudarStatusAgendamento(id, acao),
      sucesso: ROTULO_SUCESSO[acao],
    });
  }

  async function bloquearDia() {
    const motivo = window.prompt(
      'Bloquear o dia inteiro na sua agenda. Qual o motivo?',
      'Folga'
    );
    if (motivo === null) return;

    setBloqueando(true);
    try {
      const res = await bloquearMeuDia(data, motivo);
      if (res.ok) {
        toast.success('Dia bloqueado na sua agenda.');
        router.refresh();
      } else {
        toast.error(res.error ?? 'Não foi possível bloquear.');
      }
    } finally {
      setBloqueando(false);
    }
  }

  const dataLegivel = new Date(data + 'T12:00:00').toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  });

  const agora = new Date();

  return (
    <div className="space-y-4">
      {/* Navegação de data */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => irPara(somarDias(data, -1))}
          className="btn-ghost p-3"
          aria-label="Dia anterior"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <div className="text-center">
          <p className="text-sm text-fg font-medium capitalize">{dataLegivel}</p>
          {pendente && <p className="text-[10px] text-fg-dim">carregando...</p>}
        </div>

        <button
          type="button"
          onClick={() => irPara(somarDias(data, 1))}
          className="btn-ghost p-3"
          aria-label="Próximo dia"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Lista */}
      {agendamentos.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-sm text-fg-muted">Nenhum cliente marcado neste dia.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {agendamentos.map((a) => {
            const selo = montarSelo(a.assinatura, new Date(a.inicio));
            // O que a tela mostra é o status otimista, quando existe
            const status = statusLocal[a.id] ?? (a.status as StatusAgendamento);
            const acoes = podeOperar
              ? acoesDisponiveis(status, new Date(a.inicio), agora)
              : [];

            return (
              <article key={a.id} className="card p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="text-lg font-bold text-gold">{hora(a.inicio)}</span>
                      <span className="text-xs text-fg-dim">até {hora(a.fim)}</span>
                    </div>
                    <p className="text-base text-fg truncate">{a.cliente}</p>
                    {a.servicos.length > 0 && (
                      <p className="text-xs text-fg-muted">{a.servicos.join(', ')}</p>
                    )}
                  </div>

                  <span className="text-[10px] uppercase tracking-wider text-fg-dim shrink-0">
                    {rotuloEstado(status)}
                  </span>
                </div>

                {selo.situacao !== 'sem_assinatura' && (
                  <span
                    className={`inline-block text-xs px-2 py-1 rounded-md border ${corDoSelo(
                      selo.situacao
                    )}`}
                  >
                    {selo.texto}
                  </span>
                )}

                {a.observacao && (
                  <p className="text-xs text-fg-muted italic">{a.observacao}</p>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  {a.telefone && (
                    <a
                      href={`https://wa.me/55${a.telefone.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-ghost text-xs"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      WhatsApp
                    </a>
                  )}

                  {acoes.map((acao) => {
                    const info = ACAO_INFO[acao];
                    const Icon = info.icon;
                    return (
                      <button
                        key={acao}
                        type="button"
                        onClick={() => executar(a.id, acao, status)}
                        className={
                          acao === 'falta' ? 'btn-secondary text-xs' : 'btn-gold-outline text-xs'
                        }
                      >
                        <Icon className="w-3.5 h-3.5" />
                        {info.label}
                      </button>
                    );
                  })}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {podeOperar && <EncaixarCliente data={data} servicos={servicos} />}

      {podeOperar && (
        <button
          type="button"
          onClick={bloquearDia}
          disabled={bloqueando}
          className="btn-secondary w-full text-xs"
        >
          {bloqueando ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <CalendarOff className="w-4 h-4" />
          )}
          Bloquear este dia inteiro na minha agenda
        </button>
      )}
    </div>
  );
}
