export default function PainelLoading() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Carregando conteúdo">
      <div className="space-y-2">
        <div className="h-3 w-40 animate-pulse rounded bg-bg-elevated" />
        <div className="h-8 w-56 animate-pulse rounded bg-bg-elevated" />
      </div>
      <div className="card space-y-3 p-5">
        <div className="h-3 w-32 animate-pulse rounded bg-bg-elevated" />
        <div className="h-6 w-3/4 animate-pulse rounded bg-bg-elevated" />
        <div className="h-4 w-1/2 animate-pulse rounded bg-bg-elevated" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="card h-28 animate-pulse" />
        <div className="card h-28 animate-pulse" />
        <div className="card h-28 animate-pulse" />
        <div className="card h-28 animate-pulse" />
      </div>
    </div>
  );
}
