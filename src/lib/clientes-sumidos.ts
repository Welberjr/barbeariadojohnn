/**
 * Quem parou de voltar.
 *
 * A pergunta que essa tela responde e a mais cara de todas numa barbearia:
 * quem era cliente e sumiu. Trazer de volta quem ja conhece a casa custa
 * muito menos que conquistar um novo.
 *
 * O criterio nao e uma data fixa igual para todo mundo. Cliente que vinha a
 * cada 15 dias e sumiu ha 45 e mais urgente que quem vinha a cada 3 meses e
 * sumiu ha 60. Por isso a lista ordena por atraso em relacao ao ritmo DELE.
 */

export interface ClienteSumido {
  id: string;
  nome: string;
  telefone: string | null;
  ultimaVisita: string | null;
  diasSemVir: number;
  /** De quantos em quantos dias ele costumava vir */
  ritmoDias: number | null;
  /** Quantas vezes o ritmo dele ja passou. 2 significa o dobro do normal */
  atraso: number;
  visitas: number;
  totalGasto: number;
  servicoHabitual: string | null;
  contatadoEm: string | null;
}

export interface VisitaBruta {
  customerId: string;
  data: string;
  servico?: string | null;
}

export function diasEntre(de: string | Date, ate: string | Date): number {
  const a = typeof de === 'string' ? new Date(de) : de;
  const b = typeof ate === 'string' ? new Date(ate) : ate;
  return Math.floor((b.getTime() - a.getTime()) / 86400000);
}

/**
 * Ritmo do cliente: mediana do intervalo entre visitas.
 * Mediana e nao media porque uma unica sumida de seis meses no meio do
 * historico nao pode fazer parecer que ele vem de seis em seis meses.
 */
export function ritmoDoCliente(datas: string[]): number | null {
  // Duas visitas dao um intervalo so, e um intervalo so nao e ritmo: quem veio
  // segunda e terca aparecia como quem "vinha todo dia", e sumir por tres meses
  // virava "106 vezes o normal dele". Ritmo precisa de repeticao para existir.
  if (datas.length < 3) return null;

  const ordenadas = [...datas].sort();
  const intervalos: number[] = [];
  for (let i = 1; i < ordenadas.length; i++) {
    const d = diasEntre(ordenadas[i - 1], ordenadas[i]);
    if (d > 0) intervalos.push(d);
  }
  if (!intervalos.length) return null;

  intervalos.sort((a, b) => a - b);
  const meio = Math.floor(intervalos.length / 2);
  return intervalos.length % 2
    ? intervalos[meio]
    : Math.round((intervalos[meio - 1] + intervalos[meio]) / 2);
}

/**
 * Quantas vezes o ritmo do cliente ja passou desde a ultima visita.
 * Quem nao tem ritmo conhecido (veio uma vez so) e comparado com o padrao
 * da casa, que o gestor escolhe na tela.
 */
export function calcularAtraso(
  diasSemVir: number,
  ritmoDias: number | null,
  padraoDias: number
): number {
  const base = ritmoDias && ritmoDias > 0 ? ritmoDias : padraoDias;
  return Math.round((diasSemVir / base) * 10) / 10;
}

export function ordenarPorUrgencia(clientes: ClienteSumido[]): ClienteSumido[] {
  return [...clientes].sort((a, b) => {
    // Quem nunca foi chamado vem antes de quem ja foi
    const aChamado = a.contatadoEm ? 1 : 0;
    const bChamado = b.contatadoEm ? 1 : 0;
    if (aChamado !== bChamado) return aChamado - bChamado;

    // Depois, quem esta mais atrasado em relacao ao proprio ritmo
    if (b.atraso !== a.atraso) return b.atraso - a.atraso;

    // Empate: quem gastou mais na casa
    return b.totalGasto - a.totalGasto;
  });
}

/** Frase curta que explica a situacao do cliente, pronta para a tela. */
export function resumoDaAusencia(c: ClienteSumido): string {
  if (c.diasSemVir >= 365) {
    const anos = Math.floor(c.diasSemVir / 365);
    return anos === 1 ? 'há mais de 1 ano' : `há mais de ${anos} anos`;
  }
  if (c.diasSemVir >= 60) return `há ${Math.floor(c.diasSemVir / 30)} meses`;
  return `há ${c.diasSemVir} dias`;
}

/**
 * O ritmo do cliente dito como as pessoas falam.
 *
 * A tela mostrava "vinha a cada 1 dias", que alem de errado nao diz nada. Numero
 * de dias e como o sistema pensa; quem le a tela pensa em "toda semana".
 */
export function ritmoEmPalavras(ritmoDias: number | null): string | null {
  if (!ritmoDias || ritmoDias <= 0) return null;

  if (ritmoDias === 1) return 'vinha quase todo dia';
  if (ritmoDias <= 3) return `vinha de ${ritmoDias} em ${ritmoDias} dias`;
  if (ritmoDias <= 5) return 'vinha várias vezes por semana';
  if (ritmoDias <= 9) return 'vinha toda semana';
  if (ritmoDias <= 20) return 'vinha de quinze em quinze dias';
  if (ritmoDias <= 45) return 'vinha uma vez por mês';
  if (ritmoDias <= 100) return 'vinha de dois em dois meses';
  return 'vinha de vez em quando';
}

/** Link do WhatsApp com uma mensagem que a pessoa pode ajustar antes de enviar. */
export function linkWhatsApp(c: ClienteSumido, nomeBarbearia: string): string | null {
  if (!c.telefone) return null;

  const numero = c.telefone.replace(/\D/g, '');
  if (numero.length < 10) return null;

  const primeiroNome = c.nome.split(' ')[0];
  const texto =
    `Oi, ${primeiroNome}! Aqui é da ${nomeBarbearia}. ` +
    `Faz um tempo que você não aparece e a gente guardou seu horário de sempre. ` +
    `Quer marcar${c.servicoHabitual ? ' um ' + c.servicoHabitual.toLowerCase() : ''} essa semana?`;

  const comDDI = numero.startsWith('55') ? numero : `55${numero}`;
  return `https://wa.me/${comDDI}?text=${encodeURIComponent(texto)}`;
}
