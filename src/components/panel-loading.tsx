interface PanelLoadingProps {
  cards?: number;
}

export function PanelLoading({ cards = 4 }: PanelLoadingProps) {
  return (
    <div className="animate-pulse space-y-6 p-4 sm:p-6 lg:p-8" aria-busy="true" aria-label="Carregando conteúdo">
      <div className="h-8 w-48 rounded bg-bg-surface" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: cards }, (_, index) => (
          <div key={index} className="h-28 rounded-xl border border-border bg-surface" />
        ))}
      </div>
      <div className="h-64 rounded-xl border border-border bg-surface" />
    </div>
  );
}
