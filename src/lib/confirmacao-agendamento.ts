/**
 * Confirmacao de presenca pelo proprio cliente.
 *
 * A barbearia nao usa WhatsApp para isso: o pedido chega como notificacao no
 * aplicativo do cliente, e ele responde ali mesmo. O objetivo e o horario vago
 * aparecer cedo, e nao com a cadeira parada e o barbeiro esperando.
 *
 * Este arquivo tem so a regra, sem banco e sem tela, para poder ser testado.
 */

export type StatusConfirmacao =
  | 'nao_pedida'
  | 'aguardando'
  | 'confirmada'
  | 'sem_resposta';

export interface DadosConfirmacao {
  /** Status do agendamento */
  status: string;
  inicio: Date;
  pedidaEm: Date | null;
  confirmadaEm: Date | null;
}

/** Quantas horas antes o pedido de confirmacao vai para o cliente. */
export const HORAS_ANTES_PADRAO = 24;

/**
 * Um pedido so faz sentido para atendimento que ainda vai acontecer, que ainda
 * nao foi confirmado e que esta dentro da janela combinada. Fora disso, pedir
 * confirmacao so serve para incomodar.
 */
export function devePedirConfirmacao(
  dados: DadosConfirmacao,
  agora: Date,
  horasAntes: number = HORAS_ANTES_PADRAO
): boolean {
  if (dados.status !== 'scheduled') return false;
  if (dados.pedidaEm) return false;
  if (dados.confirmadaEm) return false;

  const horasQueFaltam = (dados.inicio.getTime() - agora.getTime()) / 3600000;
  if (horasQueFaltam <= 0) return false;

  return horasQueFaltam <= horasAntes;
}

/** O cliente ainda pode confirmar enquanto o atendimento nao comecou. */
export function podeConfirmar(dados: DadosConfirmacao, agora: Date): boolean {
  if (dados.confirmadaEm) return false;
  if (!['scheduled', 'confirmed'].includes(dados.status)) return false;
  return dados.inicio.getTime() > agora.getTime();
}

/**
 * Situacao para mostrar na tela.
 *
 * "sem resposta" so aparece quando o pedido foi feito e o horario esta perto:
 * antes disso o cliente ainda tem tempo de responder, e cobrar cedo demais
 * assusta sem necessidade.
 */
export function situacao(
  dados: DadosConfirmacao,
  agora: Date,
  horasParaCobrar = 6
): StatusConfirmacao {
  if (dados.confirmadaEm) return 'confirmada';
  if (!dados.pedidaEm) return 'nao_pedida';

  const horasQueFaltam = (dados.inicio.getTime() - agora.getTime()) / 3600000;
  if (horasQueFaltam <= horasParaCobrar) return 'sem_resposta';

  return 'aguardando';
}

export function rotuloSituacao(s: StatusConfirmacao): string {
  switch (s) {
    case 'confirmada':
      return 'Cliente confirmou';
    case 'aguardando':
      return 'Aguardando confirmação';
    case 'sem_resposta':
      return 'Não respondeu';
    default:
      return '';
  }
}

/** Cor do selo, no mesmo vocabulario visual do resto do painel. */
export function corSituacao(s: StatusConfirmacao): string {
  switch (s) {
    case 'confirmada':
      return 'border-success/40 bg-success/10 text-success';
    case 'sem_resposta':
      return 'border-warn/40 bg-warn/10 text-warn';
    default:
      return 'border-border bg-bg-elevated text-fg-muted';
  }
}

/** Texto da notificacao que chega para o cliente. */
export function textoDoPedido(dados: {
  primeiroNome: string;
  servico: string;
  inicio: Date;
  profissional: string | null;
}) {
  const quando = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(dados.inicio);

  const comQuem = dados.profissional ? ` com ${dados.profissional}` : '';

  return {
    titulo: 'Confirme seu horário',
    corpo: `${dados.primeiroNome}, seu ${dados.servico}${comQuem} é ${quando}. Confirme aqui no aplicativo para a gente guardar a cadeira. Se não puder vir, avise que liberamos o horário.`,
  };
}
