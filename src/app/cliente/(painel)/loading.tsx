export default function ClientePainelLoading() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Carregando conteúdo">
      <div className="h-40 animate-pulse rounded-2xl bg-bg-elevated" />
      <div className="card space-y-3 p-4">
        <div className="h-4 w-32 animate-pulse rounded bg-bg-elevated" />
        <div className="h-3 w-full animate-pulse rounded bg-bg-elevated" />
        <div className="h-3 w-3/4 animate-pulse rounded bg-bg-elevated" />
      </div>
      <div className="card space-y-3 p-4">
        <div className="h-4 w-24 animate-pulse rounded bg-bg-elevated" />
        <div className="h-20 animate-pulse rounded-xl bg-bg-elevated" />
      </div>
    </div>
  );
}
