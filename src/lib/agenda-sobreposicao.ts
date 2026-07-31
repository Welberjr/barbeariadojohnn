/**
 * Layout de agendamentos que se sobrepoem na grade da agenda.
 *
 * O problema que isso resolve: dois atendimentos no mesmo horario do mesmo
 * profissional eram desenhados no mesmo lugar, um por cima do outro, e nao
 * dava para ler nenhum dos dois. Acontece de verdade: encaixe em cima da
 * hora, atendimento que passou do tempo, importacao de sistema antigo que
 * permitia marcar em cima.
 *
 * A solucao e a mesma das agendas conhecidas: quem se cruza divide a largura.
 * Um atendimento sozinho ocupa a faixa inteira; dois no mesmo horario ficam
 * lado a lado, com metade cada.
 */

export interface FaixaHorario {
  id: string;
  /** Minuto do dia em que comeca */
  inicio: number;
  /** Minuto do dia em que termina */
  fim: number;
}

export interface PosicaoHorizontal {
  /** Qual coluna ocupa, comecando em zero */
  coluna: number;
  /** Em quantas colunas o grupo foi dividido */
  colunas: number;
}

/**
 * Devolve, para cada faixa, em qual coluna ela fica e em quantas o grupo dela
 * foi dividido.
 *
 * Trabalha por grupos: faixas que se encostam, direta ou indiretamente,
 * dividem o mesmo espaco. Assim um encaixe as 10h nao espreme a agenda das
 * 15h, que nao tem nada a ver com ele.
 */
export function calcularColunas(faixas: FaixaHorario[]): Map<string, PosicaoHorizontal> {
  const resultado = new Map<string, PosicaoHorizontal>();
  if (faixas.length === 0) return resultado;

  const ordenadas = [...faixas].sort((a, b) => a.inicio - b.inicio || a.fim - b.fim);

  let grupo: FaixaHorario[] = [];
  let fimDoGrupo = -Infinity;

  const fecharGrupo = () => {
    if (grupo.length === 0) return;

    // Dentro do grupo, cada faixa entra na primeira coluna que estiver livre
    const fimPorColuna: number[] = [];
    const colunaDe = new Map<string, number>();

    for (const faixa of grupo) {
      let coluna = fimPorColuna.findIndex((fim) => fim <= faixa.inicio);
      if (coluna === -1) {
        coluna = fimPorColuna.length;
        fimPorColuna.push(faixa.fim);
      } else {
        fimPorColuna[coluna] = faixa.fim;
      }
      colunaDe.set(faixa.id, coluna);
    }

    const total = fimPorColuna.length;
    for (const faixa of grupo) {
      resultado.set(faixa.id, { coluna: colunaDe.get(faixa.id) ?? 0, colunas: total });
    }
  };

  for (const faixa of ordenadas) {
    // Comeca depois do fim de todo mundo do grupo: e um grupo novo
    if (faixa.inicio >= fimDoGrupo) {
      fecharGrupo();
      grupo = [faixa];
      fimDoGrupo = faixa.fim;
    } else {
      grupo.push(faixa);
      fimDoGrupo = Math.max(fimDoGrupo, faixa.fim);
    }
  }
  fecharGrupo();

  return resultado;
}
