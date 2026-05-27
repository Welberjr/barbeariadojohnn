export default function AdminLoading() {
  return (
    <div className="space-y-8 animate-fade-in">
      {/* HEADER skeleton */}
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div className="space-y-2">
          <div className="h-3 w-20 bg-bg-elevated rounded animate-pulse" />
          <div className="h-9 w-48 bg-bg-elevated rounded animate-pulse" />
          <div className="h-4 w-72 bg-bg-elevated rounded animate-pulse" />
        </div>
        <div className="h-7 w-32 bg-bg-elevated rounded-full animate-pulse" />
      </div>

      <div className="divider-gold opacity-30" />

      {/* Cards skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="card p-5 h-32 animate-pulse"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <div className="h-3 w-24 bg-bg-elevated rounded mb-4" />
            <div className="h-8 w-16 bg-bg-elevated rounded mb-3" />
            <div className="h-2 w-20 bg-bg-elevated rounded" />
          </div>
        ))}
      </div>

      {/* Grid principal skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card p-6 h-96 animate-pulse">
          <div className="h-6 w-48 bg-bg-elevated rounded mb-4" />
          <div className="grid grid-cols-2 gap-3">
            {[0,1,2,3,4,5].map(i => (
              <div key={i} className="h-14 bg-bg-elevated rounded" />
            ))}
          </div>
        </div>
        <div className="space-y-6">
          <div className="card p-6 h-40 animate-pulse">
            <div className="h-5 w-32 bg-bg-elevated rounded mb-4" />
            <div className="h-10 bg-bg-elevated rounded mb-2" />
            <div className="h-10 bg-bg-elevated rounded" />
          </div>
          <div className="card p-6 h-48 animate-pulse">
            <div className="h-3 w-20 bg-bg-elevated rounded mb-3" />
            <div className="h-6 w-40 bg-bg-elevated rounded mb-4" />
            <div className="space-y-2">
              {[0,1,2,3].map(i => (
                <div key={i} className="h-4 bg-bg-elevated rounded" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
