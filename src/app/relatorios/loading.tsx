export default function Loading() {
  return (
    <div className="space-y-8 max-w-5xl">
      <div className="flex items-end justify-between">
        <div className="space-y-2">
          <div className="skeleton h-3 w-14" />
          <div className="skeleton h-8 w-36" />
        </div>
        <div className="skeleton h-3 w-32" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-card border border-border rounded-lg p-5 space-y-3">
            <div className="skeleton h-3 w-20" />
            <div className="skeleton h-7 w-28" />
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="bg-card border border-border rounded-lg p-6 space-y-4">
            <div className="skeleton h-3 w-40" />
            {Array.from({ length: 5 }).map((_, j) => (
              <div key={j} className="flex justify-between items-center py-2 border-b border-border last:border-0">
                <div className="skeleton h-3 w-32" />
                <div className="skeleton h-3 w-20" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
