/**
 * Jornada do profissional.
 *
 * A barbearia tem um horario, e cada profissional pode ter o seu. Quem chega
 * mais tarde, quem sai antes, quem nao trabalha domingo, quem para para almocar.
 * Sem isso, o cliente marcava num horario em que o barbeiro nao estava, e alguem
 * tinha que ligar depois para desmarcar.
 *
 * A tela pergunta pouco de proposito: semana, sabado, domingo e almoco. Pedir
 * sete dias separados seria mais completo e ninguem preencheria. Por baixo, isso
 * vira o mesmo formato de horario por dia que o resto do sistema ja usa.
 */

export interface HorarioDoDia {
  open?: string;
  close?: string;
  closed?: boolean;
}

export type HorarioSemanal = Record<string, HorarioDoDia>;

export interface JornadaSimples {
  /** Segunda a sexta */
  semanaAbre: string;
  semanaFecha: string;
  semanaFolga: boolean;
  sabadoAbre: string;
  sabadoFecha: string;
  sabadoFolga: boolean;
  domingoAbre: string;
  domingoFecha: string;
  domingoFolga: boolean;
  /** Vazio quando a pessoa nao para para almocar */
  almocoInicio: string;
  almocoFim: string;
}

export const DIAS_UTEIS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];

export const JORNADA_PADRAO: JornadaSimples = {
  semanaAbre: '09:00',
  semanaFecha: '20:00',
  semanaFolga: false,
  sabadoAbre: '09:00',
  sabadoFecha: '20:00',
  sabadoFolga: false,
  domingoAbre: '09:00',
  domingoFecha: '13:00',
  domingoFolga: true,
  almocoInicio: '',
  almocoFim: '',
};

function ehHora(valor: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(valor);
}

function paraMinutos(hm: string): number {
  const [h, m] = hm.split(':').map(Number);
  return h * 60 + m;
}

/** Confere a jornada antes de gravar. Devolve o primeiro problema encontrado. */
export function validarJornada(j: JornadaSimples): string | null {
  const faixas: Array<[string, string, string, boolean]> = [
    ['Semana', j.semanaAbre, j.semanaFecha, j.semanaFolga],
    ['Sábado', j.sabadoAbre, j.sabadoFecha, j.sabadoFolga],
    ['Domingo', j.domingoAbre, j.domingoFecha, j.domingoFolga],
  ];

  for (const [nome, abre, fecha, folga] of faixas) {
    if (folga) continue;
    if (!ehHora(abre) || !ehHora(fecha)) return `${nome}: horário inválido.`;
    if (paraMinutos(fecha) <= paraMinutos(abre)) {
      return `${nome}: o fim tem que ser depois do começo.`;
    }
  }

  const temAlmoco = !!j.almocoInicio || !!j.almocoFim;
  if (temAlmoco) {
    if (!ehHora(j.almocoInicio) || !ehHora(j.almocoFim)) {
      return 'Almoço: preencha as duas horas ou deixe as duas em branco.';
    }
    if (paraMinutos(j.almocoFim) <= paraMinutos(j.almocoInicio)) {
      return 'Almoço: o fim tem que ser depois do começo.';
    }
    // Almoco fora do expediente nao bloqueia nada e so confunde quem le depois
    if (!j.semanaFolga) {
      const dentro =
        paraMinutos(j.almocoInicio) >= paraMinutos(j.semanaAbre) &&
        paraMinutos(j.almocoFim) <= paraMinutos(j.semanaFecha);
      if (!dentro) return 'Almoço: precisa estar dentro do horário de trabalho.';
    }
  }

  return null;
}

/** Converte a forma simples da tela no horario por dia que o sistema usa. */
export function paraHorarioSemanal(j: JornadaSimples): HorarioSemanal {
  const semana: HorarioDoDia = j.semanaFolga
    ? { closed: true }
    : { open: j.semanaAbre, close: j.semanaFecha, closed: false };

  const horario: HorarioSemanal = {};
  for (const dia of DIAS_UTEIS) horario[dia] = { ...semana };

  horario.saturday = j.sabadoFolga
    ? { closed: true }
    : { open: j.sabadoAbre, close: j.sabadoFecha, closed: false };

  horario.sunday = j.domingoFolga
    ? { closed: true }
    : { open: j.domingoAbre, close: j.domingoFecha, closed: false };

  return horario;
}

/** Caminho de volta, para a tela abrir com o que ja esta gravado. */
export function daJornadaGravada(
  horario: HorarioSemanal | null,
  almoco: { inicio: string | null; fim: string | null }
): JornadaSimples {
  const semana = horario?.monday;
  const sabado = horario?.saturday;
  const domingo = horario?.sunday;

  const hora = (valor: string | null | undefined, padrao: string) =>
    valor ? String(valor).slice(0, 5) : padrao;

  return {
    semanaAbre: hora(semana?.open, JORNADA_PADRAO.semanaAbre),
    semanaFecha: hora(semana?.close, JORNADA_PADRAO.semanaFecha),
    semanaFolga: semana?.closed === true,
    sabadoAbre: hora(sabado?.open, JORNADA_PADRAO.sabadoAbre),
    sabadoFecha: hora(sabado?.close, JORNADA_PADRAO.sabadoFecha),
    sabadoFolga: sabado?.closed === true,
    domingoAbre: hora(domingo?.open, JORNADA_PADRAO.domingoAbre),
    domingoFecha: hora(domingo?.close, JORNADA_PADRAO.domingoFecha),
    domingoFolga: domingo ? domingo.closed === true : JORNADA_PADRAO.domingoFolga,
    almocoInicio: hora(almoco.inicio, ''),
    almocoFim: hora(almoco.fim, ''),
  };
}

/** Resumo curto para a lista de profissionais. */
export function resumoDaJornada(j: JornadaSimples, segueALoja: boolean): string {
  if (segueALoja) return 'Segue o horário da barbearia';

  const partes: string[] = [];
  partes.push(
    j.semanaFolga ? 'Não atende em dia de semana' : `Semana ${j.semanaAbre} às ${j.semanaFecha}`
  );
  partes.push(j.sabadoFolga ? 'sábado não' : `sábado ${j.sabadoAbre} às ${j.sabadoFecha}`);
  if (!j.domingoFolga) partes.push(`domingo ${j.domingoAbre} às ${j.domingoFecha}`);
  if (j.almocoInicio && j.almocoFim) {
    partes.push(`almoço ${j.almocoInicio} às ${j.almocoFim}`);
  }

  return partes.join(' · ');
}
