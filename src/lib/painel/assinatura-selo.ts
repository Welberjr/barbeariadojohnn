/**
 * Selo de assinatura mostrado ao lado do cliente, na agenda e na comanda.
 *
 * Parte pura: recebe a assinatura ja resolvida e a data do atendimento, e diz
 * o que o barbeiro precisa saber antes de encostar na tesoura, principalmente
 * "isso aqui cobre ou vai cobrar avulso".
 *
 * A ordem das situacoes importa: sempre vence a que impede a cobertura, e
 * entre as que impedem, a que o barbeiro precisa explicar para o cliente.
 */
import { formatAllowedDays, isDayAllowed } from '@/lib/subscriptions';

export type SituacaoAssinatura =
  | 'sem_assinatura'
  | 'com_saldo'
  | 'sem_saldo'
  | 'vencida'
  | 'fora_do_dia';

export interface AssinaturaResumo {
  planoNome: string;
  usosIncluidos: number;
  usosNoCiclo: number;
  usosRestantes: number;
  fimDoCiclo: string;
  diasPermitidos: number[] | null;
  vencida: boolean;
}

export interface Selo {
  situacao: SituacaoAssinatura;
  /** Texto curto que aparece na tela, ja pronto para o barbeiro ler */
  texto: string;
  /** Verdadeiro quando o atendimento de hoje pode ser coberto pela assinatura */
  cobre: boolean;
}

export function montarSelo(
  assinatura: AssinaturaResumo | null,
  quando: Date
): Selo {
  if (!assinatura) {
    return { situacao: 'sem_assinatura', texto: '', cobre: false };
  }

  const plano = assinatura.planoNome;

  if (assinatura.vencida) {
    return {
      situacao: 'vencida',
      texto: `${plano} · vencido, aguardando pagamento. Não cobre hoje`,
      cobre: false,
    };
  }

  if (assinatura.usosRestantes <= 0) {
    return {
      situacao: 'sem_saldo',
      texto: `${plano} · usos esgotados neste ciclo, cobrar avulso`,
      cobre: false,
    };
  }

  if (!isDayAllowed(quando, assinatura.diasPermitidos)) {
    return {
      situacao: 'fora_do_dia',
      texto: `${plano} · o plano cobre ${formatAllowedDays(
        assinatura.diasPermitidos
      ).toLowerCase()}, hoje cobra avulso`,
      cobre: false,
    };
  }

  return {
    situacao: 'com_saldo',
    texto: `${plano} · restam ${assinatura.usosRestantes} de ${assinatura.usosIncluidos}`,
    cobre: true,
  };
}

/** Cor do selo na interface, seguindo o padrao do projeto. */
export function corDoSelo(situacao: SituacaoAssinatura): string {
  switch (situacao) {
    case 'com_saldo':
      return 'text-success border-success/40 bg-success/10';
    case 'sem_saldo':
    case 'fora_do_dia':
      return 'text-warn border-warn/40 bg-warn/10';
    case 'vencida':
      return 'text-danger border-danger/40 bg-danger/10';
    default:
      return 'text-fg-muted border-border bg-bg-elevated';
  }
}
