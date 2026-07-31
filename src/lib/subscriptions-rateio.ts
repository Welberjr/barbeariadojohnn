/**
 * Rateio da parte dos barbeiros na assinatura, por corte usado.
 *
 * Regra combinada com o Welber em 28/07/2026, substituindo o rateio anterior:
 *
 *   ANTES: a parte dos barbeiros era dividida INTEIRA entre quem atendeu no
 *   ciclo. Cliente que ia 3 de 4 vezes nao mudava nada no bolso de ninguem, e
 *   nao existia sobra nenhuma para a barbearia.
 *
 *   AGORA: cada corte incluso vale uma fatia fixa (parte dos barbeiros
 *   dividida pelos cortes do plano). O barbeiro leva pelo que atendeu, e o que
 *   o cliente nao usou vira SOBRA, com destino escolhido no plano.
 *
 * Exemplo (plano de R$ 120, 4 cortes, 50% para os barbeiros):
 *   parte dos barbeiros = R$ 60, cada corte vale R$ 15.
 *   Cliente foi 3 vezes, tudo com o Carlos: Carlos leva R$ 45 e sobram R$ 15.
 *
 * Tudo em centavos, para nao existir centavo perdido em ponto flutuante.
 */

export type DestinoSobra = 'barbearia' | 'dividir_igual' | 'maior_performance';

export const DESTINO_SOBRA_INFO: Record<DestinoSobra, { label: string; ajuda: string }> = {
  barbearia: {
    label: 'Fica com a barbearia',
    ajuda: 'O que o cliente não usou não é repassado. É o comportamento padrão.',
  },
  dividir_igual: {
    label: 'Dividir igual entre quem atendeu',
    ajuda: 'A sobra é dividida em partes iguais entre os profissionais que atenderam no ciclo.',
  },
  maior_performance: {
    label: 'Para quem mais atendeu',
    ajuda: 'A sobra inteira vai para o profissional com mais atendimentos no ciclo.',
  },
};

export function ehDestinoSobra(valor: unknown): valor is DestinoSobra {
  return valor === 'barbearia' || valor === 'dividir_igual' || valor === 'maior_performance';
}

export function lerDestinoSobra(valor: unknown): DestinoSobra {
  return ehDestinoSobra(valor) ? valor : 'barbearia';
}

export interface UsosPorProfissional {
  staff_id: string;
  uses: number;
}

export interface ItemRateio {
  staff_id: string;
  uses: number;
  /** Valor pelos cortes que ele atendeu */
  baseCents: number;
  /** Parte da sobra que coube a ele, conforme o destino do plano */
  sobraCents: number;
  /** baseCents + sobraCents */
  amountCents: number;
}

export interface ResultadoRateio {
  /** Quanto vale cada corte incluso do plano */
  valorPorUsoCents: number;
  /** Cortes inclusos que o cliente nao usou */
  usosNaoUsados: number;
  /** O que os profissionais levam no total */
  totalDistribuidoCents: number;
  /** O que fica com a barbearia */
  sobraDaBarbeariaCents: number;
  items: ItemRateio[];
}

/**
 * Ordem determinística para desempate: mais usos primeiro, depois o id.
 * Sem isso, dois fechamentos do mesmo ciclo poderiam dar resultados
 * diferentes só pela ordem que o banco devolveu as linhas.
 */
function ordenar(items: UsosPorProfissional[]): UsosPorProfissional[] {
  return [...items].sort((a, b) => b.uses - a.uses || a.staff_id.localeCompare(b.staff_id));
}

export function ratearPotinho(entrada: {
  poolCents: number;
  includedUses: number;
  byStaff: UsosPorProfissional[];
  destinoSobra: DestinoSobra;
}): ResultadoRateio {
  const poolCents = Math.max(0, Math.round(entrada.poolCents));
  const includedUses = Math.max(0, Math.floor(entrada.includedUses));
  const participantes = ordenar(entrada.byStaff.filter((b) => b.uses > 0));

  const vazio: ResultadoRateio = {
    valorPorUsoCents: 0,
    usosNaoUsados: includedUses,
    totalDistribuidoCents: 0,
    sobraDaBarbeariaCents: poolCents,
    items: [],
  };

  if (poolCents === 0 || includedUses === 0) {
    return { ...vazio, usosNaoUsados: includedUses, sobraDaBarbeariaCents: poolCents };
  }
  // Ninguem atendeu no ciclo: nao ha entre quem dividir, o valor fica na casa
  if (participantes.length === 0) return vazio;

  const valorPorUsoCents = Math.floor(poolCents / includedUses);

  const items: ItemRateio[] = participantes.map((p) => {
    // Cliente que usou mais do que o plano inclui (cortesia da casa) nao pode
    // gerar repasse maior que a parte dos barbeiros
    const usosPagos = Math.min(p.uses, includedUses);
    const base = usosPagos * valorPorUsoCents;
    return {
      staff_id: p.staff_id,
      uses: p.uses,
      baseCents: base,
      sobraCents: 0,
      amountCents: base,
    };
  });

  const distribuidoBase = items.reduce((s, i) => s + i.baseCents, 0);
  let sobraCents = poolCents - distribuidoBase;

  const usosPagosTotal = items.reduce((s, i) => s + Math.min(i.uses, includedUses), 0);
  const usosNaoUsados = Math.max(0, includedUses - usosPagosTotal);

  if (sobraCents > 0 && entrada.destinoSobra !== 'barbearia') {
    if (entrada.destinoSobra === 'maior_performance') {
      items[0].sobraCents = sobraCents;
      items[0].amountCents += sobraCents;
      sobraCents = 0;
    } else {
      // Divide igual e distribui o resto de centavos de forma determinística,
      // um a um, começando por quem mais atendeu
      const porCabeca = Math.floor(sobraCents / items.length);
      for (const item of items) {
        item.sobraCents = porCabeca;
        item.amountCents += porCabeca;
      }
      let resto = sobraCents - porCabeca * items.length;
      let i = 0;
      while (resto > 0) {
        items[i % items.length].sobraCents += 1;
        items[i % items.length].amountCents += 1;
        resto -= 1;
        i += 1;
      }
      sobraCents = 0;
    }
  }

  return {
    valorPorUsoCents,
    usosNaoUsados,
    totalDistribuidoCents: items.reduce((s, i) => s + i.amountCents, 0),
    sobraDaBarbeariaCents: sobraCents,
    items,
  };
}
