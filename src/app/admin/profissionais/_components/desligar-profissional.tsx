'use client';

/**
 * Desligar ou apagar a ficha de um profissional.
 *
 * Mandar alguem embora nao e so tirar da lista: tem cliente marcado com ele,
 * pode ter comanda aberta travando o caixa e quase sempre tem comissao a
 * acertar. A tela mostra isso ANTES, porque quem decide precisa saber o que vai
 * acontecer, e nao descobrir na segunda-feira quando o cliente aparecer.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { UserMinus, Loader2, Trash2, UserCheck, AlertTriangle } from 'lucide-react';

import {
  deactivateStaff,
  reactivateStaff,
  excluirProfissional,
  pendenciasDoProfissional,
} from '../actions';
import { formatCurrency } from '@/lib/utils';

interface Props {
  staffId: string;
  displayName: string;
  ativo: boolean;
}

interface Pendencias {
  agendamentosFuturos: number;
  comandasAbertas: number;
  valesPendentes: number;
  atendimentosFeitos: number;
  comissaoGerada: number;
  podeApagarDeVez: boolean;
}

export function DesligarProfissional({ staffId, displayName, ativo }: Props) {
  const router = useRouter();
  const [abrindo, setAbrindo] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [pendencias, setPendencias] = useState<Pendencias | null>(null);
  const [motivo, setMotivo] = useState('');
  const [confirmandoApagar, setConfirmandoApagar] = useState(false);

  const primeiroNome = displayName.split(' ')[0];

  async function abrir() {
    setAbrindo(true);
    try {
      const p = await pendenciasDoProfissional(staffId);
      setPendencias(p);
    } finally {
      setAbrindo(false);
    }
  }

  async function desligar() {
    setOcupado(true);
    try {
      const res = await deactivateStaff(staffId, motivo);
      if (!res.ok) {
        toast.error(res.error ?? 'Não foi possível desligar.');
        return;
      }
      toast.success(
        res.agendamentosCancelados
          ? `${primeiroNome} desligado. ${res.agendamentosCancelados} atendimento(s) futuro(s) foram cancelados.`
          : `${primeiroNome} desligado.`
      );
      setPendencias(null);
      router.refresh();
    } finally {
      setOcupado(false);
    }
  }

  async function reativar() {
    setOcupado(true);
    try {
      const res = await reactivateStaff(staffId);
      if (res.ok) {
        toast.success(`${primeiroNome} está de volta.`);
        router.refresh();
      } else {
        toast.error(res.error ?? 'Não foi possível reativar.');
      }
    } finally {
      setOcupado(false);
    }
  }

  async function apagar() {
    setOcupado(true);
    try {
      const res = await excluirProfissional(staffId);
      if (!res.ok) {
        toast.error(res.error ?? 'Não foi possível apagar.');
        return;
      }
      toast.success('Ficha apagada.');
      router.push('/admin/profissionais');
    } finally {
      setOcupado(false);
    }
  }

  // ── Quem já saiu: só a volta ────────────────────────────────────────
  if (!ativo) {
    return (
      <section className="card space-y-3 p-5">
        <p className="text-[10px] uppercase tracking-[0.25em] text-fg-dim">Desligado</p>
        <p className="text-sm text-fg-muted">
          {primeiroNome} não aparece na agenda, não entra no painel e não pode ser escolhido em
          comanda nova. O que ele já atendeu continua no histórico e no caixa.
        </p>
        <button type="button" onClick={reativar} disabled={ocupado} className="btn-secondary w-full">
          {ocupado ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCheck className="h-4 w-4" />}
          Trazer {primeiroNome} de volta
        </button>
      </section>
    );
  }

  return (
    <section className="card space-y-3 p-5">
      <p className="text-[10px] uppercase tracking-[0.25em] text-fg-dim">Saída da equipe</p>

      {!pendencias ? (
        <>
          <p className="text-sm text-fg-muted">
            Quando alguém sai da barbearia, o acesso dele precisa morrer no mesmo dia.
          </p>
          <button
            type="button"
            onClick={abrir}
            disabled={abrindo}
            className="btn-secondary w-full text-danger"
          >
            {abrindo ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserMinus className="h-4 w-4" />}
            Desligar {primeiroNome}
          </button>
        </>
      ) : (
        <div className="space-y-4">
          {/* O que acontece, dito antes de acontecer */}
          <div className="space-y-2 rounded-lg border border-border/60 bg-bg-elevated/40 p-3">
            <p className="text-sm text-fg">O que muda ao desligar {primeiroNome}:</p>
            <ul className="space-y-1 text-xs text-fg-muted">
              <li>Perde o acesso ao painel na hora, mesmo se estiver logado agora.</li>
              <li>Sai da agenda e não pode ser escolhido em comanda nova.</li>
              <li>
                Os {pendencias.atendimentosFeitos} atendimentos dele continuam no caixa e no
                histórico.
              </li>
            </ul>
          </div>

          {(pendencias.agendamentosFuturos > 0 ||
            pendencias.comandasAbertas > 0 ||
            pendencias.valesPendentes > 0 ||
            pendencias.comissaoGerada > 0) && (
            <div className="space-y-2 rounded-lg border border-warn/40 bg-warn/5 p-3">
              <p className="flex items-center gap-1.5 text-sm text-warn">
                <AlertTriangle className="h-4 w-4" />
                Resolva ou tenha em mente
              </p>
              <ul className="space-y-1 text-xs text-fg-muted">
                {pendencias.agendamentosFuturos > 0 && (
                  <li>
                    <span className="text-fg">{pendencias.agendamentosFuturos}</span> cliente(s)
                    marcado(s) com ele. Vão ser cancelados: remarque com outro barbeiro antes, se
                    quiser manter.
                  </li>
                )}
                {pendencias.comandasAbertas > 0 && (
                  <li>
                    <span className="text-fg">{pendencias.comandasAbertas}</span> comanda(s)
                    aberta(s). Feche antes, senão ficam paradas no caixa.
                  </li>
                )}
                {pendencias.valesPendentes > 0 && (
                  <li>
                    <span className="text-fg">{pendencias.valesPendentes}</span> vale(s) pendente(s)
                    de aprovação.
                  </li>
                )}
                {pendencias.comissaoGerada > 0 && (
                  <li>
                    Já gerou{' '}
                    <span className="text-fg">{formatCurrency(pendencias.comissaoGerada)}</span> de
                    comissão. Confira o acerto no Financeiro antes de fechar a conta com ele.
                  </li>
                )}
              </ul>
            </div>
          )}

          <input
            type="text"
            className="input"
            placeholder="Motivo (fica registrado)"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            maxLength={120}
          />

          <div className="flex gap-2">
            <button
              type="button"
              onClick={desligar}
              disabled={ocupado}
              className="btn-secondary flex-1 text-danger"
            >
              {ocupado ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UserMinus className="h-4 w-4" />
              )}
              Desligar
            </button>
            <button
              type="button"
              onClick={() => {
                setPendencias(null);
                setConfirmandoApagar(false);
              }}
              className="btn-primary flex-1"
            >
              Voltar
            </button>
          </div>

          {/* Apagar de vez: só para cadastro que nunca virou atendimento */}
          {pendencias.podeApagarDeVez && (
            <div className="border-t border-border/40 pt-3">
              {!confirmandoApagar ? (
                <>
                  <p className="mb-2 text-[11px] text-fg-subtle">
                    Cadastrou errado e essa pessoa nunca atendeu ninguém? Dá para apagar a ficha
                    de vez, com o acesso dela.
                  </p>
                  <button
                    type="button"
                    onClick={() => setConfirmandoApagar(true)}
                    className="btn-ghost w-full text-xs text-danger"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Apagar a ficha de vez
                  </button>
                </>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-warn">
                    Isso apaga o cadastro e o login de {primeiroNome}. Não tem volta.
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={apagar}
                      disabled={ocupado}
                      className="btn-secondary flex-1 text-xs text-danger"
                    >
                      {ocupado ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                      Apagar mesmo assim
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmandoApagar(false)}
                      className="btn-primary flex-1 text-xs"
                    >
                      Não
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
