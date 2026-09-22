export default function Loading() {
  return (
    <div className="space-y-8 max-w-5xl">
      <div className="flex items-end justify-between">
        <div className="space-y-2">
          <div className="skeleton h-3 w-16" />
          <div className="skeleton h-8 w-32" />
        </div>
        <div className="skeleton h-3 w-40" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-card border border-border rounded-lg p-5 space-y-3">
            <div className="skeleton h-3 w-20" />
            <div className="skeleton h-7 w-28" />
          </div>
        ))}
      </div>

      <div className="bg-card border border-border rounded-lg p-6 space-y-4">
        <div className="skeleton h-3 w-36" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between py-3 border-b border-border last:border-0">
            <div className="flex items-center gap-3">
              <div className="skeleton w-1.5 h-1.5 rounded-full" />
              <div className="space-y-1.5">
                <div className="skeleton h-3 w-40" />
                <div className="skeleton h-2.5 w-20" />
              </div>
            </div>
            <div className="skeleton h-3 w-24" />
          </div>
        ))}
      </div>
    </div>
  )
}
