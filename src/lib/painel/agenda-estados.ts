/**
 * Maquina de estados do agendamento, do ponto de vista do barbeiro.
 *
 * Existe para as acoes do painel nao inventarem regra propria: sem isso, uma
 * tela deixaria concluir atendimento cancelado e outra deixaria marcar falta
 * antes da hora marcada.
 *
 * Estados do banco: scheduled | confirmed | in_progress | completed |
 * cancelled | no_show. Os tres ultimos sao finais para o barbeiro: desfazer e
 * assunto da gestao.
 */

export type StatusAgendamento =
  | 'scheduled'
  | 'confirmed'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'no_show';

export type AcaoAgenda = 'confirmar' | 'iniciar' | 'concluir' | 'falta';

const FINAIS: StatusAgendamento[] = ['completed', 'cancelled', 'no_show'];

const TRANSICOES: Record<AcaoAgenda, { de: StatusAgendamento[]; para: StatusAgendamento }> = {
  confirmar: { de: ['scheduled'], para: 'confirmed' },
  iniciar: { de: ['scheduled', 'confirmed'], para: 'in_progress' },
  concluir: { de: ['scheduled', 'confirmed', 'in_progress'], para: 'completed' },
  falta: { de: ['scheduled', 'confirmed'], para: 'no_show' },
};

const NOME_ESTADO: Record<StatusAgendamento, string> = {
  scheduled: 'agendado',
  confirmed: 'confirmado',
  in_progress: 'em atendimento',
  completed: 'concluído',
  cancelled: 'cancelado',
  no_show: 'marcado como falta',
};

export interface ResultadoTransicao {
  ok: boolean;
  proximo?: StatusAgendamento;
  motivo?: string;
}

/**
 * Diz se a acao pode acontecer agora.
 * `inicio` e o horario marcado, usado para impedir falta antes da hora.
 */
export function avaliarAcao(
  status: StatusAgendamento,
  acao: AcaoAgenda,
  inicio: Date,
  agora: Date = new Date()
): ResultadoTransicao {
  if (FINAIS.includes(status)) {
    return {
      ok: false,
      motivo: `Este atendimento já está ${NOME_ESTADO[status]}. Fale com a gestão para mudar.`,
    };
  }

  const regra = TRANSICOES[acao];
  if (!regra.de.includes(status)) {
    return {
      ok: false,
      motivo: `Não dá para fazer isso com um atendimento ${NOME_ESTADO[status]}.`,
    };
  }

  if (acao === 'falta' && agora < inicio) {
    return {
      ok: false,
      motivo: 'Ainda não deu o horário. Marque a falta depois da hora marcada.',
    };
  }

  return { ok: true, proximo: regra.para };
}

/** Acoes que a tela deve mostrar para o estado atual. */
export function acoesDisponiveis(
  status: StatusAgendamento,
  inicio: Date,
  agora: Date = new Date()
): AcaoAgenda[] {
  const todas: AcaoAgenda[] = ['confirmar', 'iniciar', 'concluir', 'falta'];
  return todas.filter((acao) => avaliarAcao(status, acao, inicio, agora).ok);
}

export function rotuloEstado(status: StatusAgendamento): string {
  return NOME_ESTADO[status] ?? status;
}
