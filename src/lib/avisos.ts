/**
 * Textos e regras dos avisos, sem banco e sem tela.
 *
 * Ficam num lugar so porque o mesmo aviso sai de tres portas: o cliente marcando
 * pelo aplicativo, a recepcao marcando pelo admin e o barbeiro encaixando no
 * painel. Se cada uma escrevesse o proprio texto, o cliente receberia tres
 * recados diferentes para a mesma coisa.
 */

/** Data e hora no jeito que a gente fala, no fuso da barbearia. */
export function quandoEmPalavras(iso: string): string {
  const d = new Date(iso);
  const data = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
  }).format(d);
  const hora = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
  return `${data} às ${hora}`;
}

/**
 * Aviso de horario marcado PELA barbearia.
 *
 * Diferente do aviso de quem marcou sozinho: aqui a pessoa nao sabia que isso ia
 * acontecer, entao o recado precisa dizer com quem e quando, e deixar claro que
 * ela pode desmarcar pelo aplicativo. Um horario que aparece do nada na agenda
 * de alguem, sem porta de saida, vira falta no dia.
 */
export function avisoDeHorarioMarcado(opts: {
  servico?: string | null;
  profissional?: string | null;
  quandoISO: string;
}): { titulo: string; corpo: string } {
  const quando = quandoEmPalavras(opts.quandoISO);
  const comQuem = opts.profissional ? ` com ${opts.profissional}` : '';
  const oQue = opts.servico ?? 'Seu horário';

  return {
    titulo: 'Marcamos um horário para você ✂️',
    corpo: `${oQue}${comQuem} em ${quando}. Se não puder vir, dá para desmarcar por aqui mesmo.`,
  };
}

/** Aviso de horario desmarcado PELA barbearia. */
export function avisoDeHorarioDesmarcado(opts: {
  quandoISO: string;
  motivo?: string | null;
}): { titulo: string; corpo: string } {
  const quando = quandoEmPalavras(opts.quandoISO);
  const motivo = opts.motivo?.trim();

  return {
    titulo: 'Seu horário foi desmarcado',
    corpo: motivo
      ? `O horário de ${quando} foi desmarcado: ${motivo}. Fale com a gente para remarcar.`
      : `O horário de ${quando} foi desmarcado. Fale com a gente para remarcar.`,
  };
}

/**
 * Desde quando contar novidade no sino.
 *
 * A tela guarda a ultima vez que a pessoa abriu o sino. Sem essa marca (primeira
 * vez, ou navegador limpo), o padrao e olhar o dia: mostrar tudo desde o comeco
 * dos tempos encheria a lista de coisa velha e o aviso perderia a graca.
 *
 * A marca tambem nao pode ser antiga demais: quem passou uma semana sem abrir
 * veria dezenas de linhas de uma vez.
 */
export function desdeQuandoOlhar(
  ultimaVezISO: string | null,
  agora: Date = new Date(),
  limiteHoras = 48
): string {
  const teto = new Date(agora.getTime() - limiteHoras * 3600000);
  if (!ultimaVezISO) return teto.toISOString();

  const ultima = new Date(ultimaVezISO);
  if (Number.isNaN(ultima.getTime())) return teto.toISOString();
  if (ultima < teto) return teto.toISOString();
  if (ultima > agora) return agora.toISOString();

  return ultima.toISOString();
}

/** "há 5 min", "há 2h", "ontem" */
export function haQuantoTempo(iso: string, agora: Date = new Date()): string {
  const minutos = Math.floor((agora.getTime() - new Date(iso).getTime()) / 60000);
  if (minutos < 1) return 'agora';
  if (minutos < 60) return `há ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `há ${horas}h`;
  const dias = Math.floor(horas / 24);
  return dias === 1 ? 'ontem' : `há ${dias} dias`;
}
