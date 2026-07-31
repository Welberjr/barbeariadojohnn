/**
 * Esqueleto de tela carregando.
 *
 * Existe por um motivo medido: sem um esqueleto no proprio segmento, o Next
 * segura a tela antiga ate a nova resposta chegar. Na producao isso deu de 208
 * a 294 milissegundos com a tela parada depois do clique, e tela parada e lida
 * como "nao funcionou" por quem esta com o cliente na cadeira.
 *
 * Com o esqueleto, a troca acontece no mesmo quadro do clique: a pessoa ve na
 * hora que o sistema entendeu, e o conteudo entra por cima quando chega.
 */

type Variante = 'lista' | 'cards' | 'tabela' | 'formulario';

const BLOCO = 'animate-pulse rounded bg-bg-elevated';

export function Esqueleto({
  variante = 'lista',
  linhas = 5,
}: {
  variante?: Variante;
  linhas?: number;
}) {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Carregando conteúdo">
      {/* Cabeçalho: o mesmo em toda tela */}
      <div className="space-y-2">
        <div className={`h-3 w-32 ${BLOCO}`} />
        <div className={`h-8 w-56 ${BLOCO}`} />
      </div>

      {variante === 'cards' && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card h-28 animate-pulse" />
          ))}
        </div>
      )}

      {variante === 'formulario' && (
        <div className="card space-y-4 p-5">
          {Array.from({ length: linhas }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className={`h-3 w-24 ${BLOCO}`} />
              <div className={`h-10 w-full ${BLOCO}`} />
            </div>
          ))}
        </div>
      )}

      {variante === 'tabela' && (
        <div className="card overflow-hidden">
          <div className="divide-y divide-border/40">
            {Array.from({ length: linhas }).map((_, i) => (
              <div key={i} className="flex items-center justify-between gap-4 p-4">
                <div className="min-w-0 flex-1 space-y-2">
                  <div className={`h-4 w-1/3 ${BLOCO}`} />
                  <div className={`h-3 w-1/2 ${BLOCO}`} />
                </div>
                <div className={`h-8 w-20 shrink-0 ${BLOCO}`} />
              </div>
            ))}
          </div>
        </div>
      )}

      {variante === 'lista' &&
        Array.from({ length: linhas }).map((_, i) => (
          <div key={i} className="card space-y-3 p-4">
            <div className={`h-4 w-1/3 ${BLOCO}`} />
            <div className={`h-3 w-2/3 ${BLOCO}`} />
          </div>
        ))}
    </div>
  );
}
