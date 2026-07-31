'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { formatCurrency } from '@/lib/utils';

/**
 * Documento do DRE para papel.
 *
 * Existe separado da tela de proposito. Imprimir a tela sempre parece site
 * impresso: cartao com borda, cor que some no preto e branco, bloco cortado
 * no meio. Aqui o layout e desenhado como relatorio, com tipografia, regras
 * finas e valores alinhados na mesma coluna.
 *
 * O documento e montado direto no body, fora da interface. Esconder a tela
 * com visibility deixava o espaco dela ocupado, e era isso que gerava a
 * segunda folha em branco e a moldura em volta do relatorio. Sendo filho do
 * body, basta esconder os irmaos na hora de imprimir.
 */

interface LinhaDRE {
  rotulo: string;
  valor: number;
  /** Recuada e menor: detalhe de uma linha principal */
  detalhe?: boolean;
  /** Linha de subtotal, com regra acima e peso maior */
  subtotal?: boolean;
  /** Resultado final, com faixa de destaque */
  resultado?: boolean;
  /** Valor que reduz o resultado, mostrado com sinal negativo */
  negativo?: boolean;
}

export interface RelatorioImpressoProps {
  periodoDe: string;
  periodoAte: string;
  receitaBruta: number;
  totalServicos: number;
  totalProdutos: number;
  receitasExtras: number;
  taxasCartao: number;
  receitaLiquida: number;
  custoProdutos: number;
  comissoes: number;
  margemBruta: number;
  despesas: number;
  lucroLiquido: number;
  margemLiquidaPct: number;
  pctServicos: number;
  pctProdutos: number;
  pctReceitasExtras: number;
  despesasPorCategoria: Array<{ name: string; total: number; count: number }>;
}

function dataBR(iso: string) {
  return iso.split('-').reverse().join('/');
}

export function RelatorioImpresso(p: RelatorioImpressoProps) {
  // O portal só existe no navegador, então só monta depois da hidratação
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);

  const linhas: LinhaDRE[] = [
    { rotulo: 'Receita bruta', valor: p.receitaBruta, subtotal: true },
    { rotulo: 'Serviços', valor: p.totalServicos, detalhe: true },
    { rotulo: 'Produtos', valor: p.totalProdutos, detalhe: true },
    ...(p.receitasExtras > 0
      ? [{ rotulo: 'Outras receitas', valor: p.receitasExtras, detalhe: true }]
      : []),
    { rotulo: 'Taxas de cartão', valor: p.taxasCartao, negativo: true },
    { rotulo: 'Receita líquida', valor: p.receitaLiquida, subtotal: true },
    { rotulo: 'Custo dos produtos vendidos', valor: p.custoProdutos, negativo: true },
    { rotulo: 'Comissões', valor: p.comissoes, negativo: true },
    { rotulo: 'Margem bruta', valor: p.margemBruta, subtotal: true },
    { rotulo: 'Despesas operacionais', valor: p.despesas, negativo: true },
    { rotulo: 'Lucro líquido', valor: p.lucroLiquido, resultado: true },
  ];

  const composicao = [
    { rotulo: 'Serviços', valor: p.totalServicos, pct: p.pctServicos },
    { rotulo: 'Produtos', valor: p.totalProdutos, pct: p.pctProdutos },
    ...(p.receitasExtras > 0
      ? [{ rotulo: 'Outras receitas', valor: p.receitasExtras, pct: p.pctReceitasExtras }]
      : []),
  ];

  if (!montado) return null;

  return createPortal(
    <div className="doc">
      {/* Cabeçalho */}
      <header className="doc-header">
        <div>
          <p className="doc-marca">Barbearia do Johnn</p>
          <h1 className="doc-titulo">Demonstrativo de resultados</h1>
        </div>
        <div className="doc-periodo">
          <p className="doc-periodo-label">Período</p>
          <p className="doc-periodo-valor">
            {dataBR(p.periodoDe)} a {dataBR(p.periodoAte)}
          </p>
        </div>
      </header>

      {/* Resumo em três números */}
      <section className="doc-resumo">
        <div>
          <p className="doc-resumo-label">Receita bruta</p>
          <p className="doc-resumo-valor">{formatCurrency(p.receitaBruta)}</p>
        </div>
        <div>
          <p className="doc-resumo-label">Custos e despesas</p>
          <p className="doc-resumo-valor">
            {formatCurrency(p.taxasCartao + p.custoProdutos + p.comissoes + p.despesas)}
          </p>
        </div>
        <div>
          <p className="doc-resumo-label">Lucro líquido</p>
          <p className="doc-resumo-valor doc-resumo-destaque">
            {formatCurrency(p.lucroLiquido)}
          </p>
          <p className="doc-resumo-nota">
            Margem de {p.margemLiquidaPct.toFixed(1)}%
          </p>
        </div>
      </section>

      {/* Demonstrativo */}
      <section className="doc-bloco">
        <h2 className="doc-bloco-titulo">Apuração do período</h2>
        <table className="doc-tabela">
          <tbody>
            {linhas.map((l, i) => (
              <tr
                key={`${l.rotulo}-${i}`}
                className={[
                  l.detalhe ? 'linha-detalhe' : '',
                  l.subtotal ? 'linha-subtotal' : '',
                  l.resultado ? 'linha-resultado' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <td>{l.rotulo}</td>
                <td className="doc-valor">
                  {l.negativo && l.valor > 0 ? '(' : ''}
                  {formatCurrency(l.valor)}
                  {l.negativo && l.valor > 0 ? ')' : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Duas colunas: composição e despesas */}
      <div className="doc-duas-colunas">
        <section className="doc-bloco">
          <h2 className="doc-bloco-titulo">Composição da receita</h2>
          <table className="doc-tabela">
            <tbody>
              {composicao.map((c) => (
                <tr key={c.rotulo}>
                  <td>
                    {c.rotulo}
                    <span className="doc-pct">{c.pct.toFixed(1)}%</span>
                  </td>
                  <td className="doc-valor">{formatCurrency(c.valor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="doc-bloco">
          <h2 className="doc-bloco-titulo">Despesas por categoria</h2>
          {p.despesasPorCategoria.length === 0 ? (
            <p className="doc-vazio">Nenhuma despesa paga no período.</p>
          ) : (
            <table className="doc-tabela">
              <tbody>
                {p.despesasPorCategoria.map((d) => (
                  <tr key={d.name}>
                    <td>
                      {d.name}
                      <span className="doc-pct">
                        {d.count} {d.count === 1 ? 'conta' : 'contas'}
                      </span>
                    </td>
                    <td className="doc-valor">{formatCurrency(d.total)}</td>
                  </tr>
                ))}
                <tr className="linha-subtotal">
                  <td>Total</td>
                  <td className="doc-valor">{formatCurrency(p.despesas)}</td>
                </tr>
              </tbody>
            </table>
          )}
        </section>
      </div>

      <footer className="doc-rodape">
        <span>Barbearia do Johnn</span>
        <span>
          Emitido em{' '}
          {new Date().toLocaleString('pt-BR', {
            timeZone: 'America/Sao_Paulo',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      </footer>
    </div>,
    document.body
  );
}
