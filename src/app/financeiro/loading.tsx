export default function Loading() {
  return (
    <div className="space-y-8 max-w-5xl">
      <div className="space-y-2">
        <div className="skeleton h-3 w-16" />
        <div className="skeleton h-8 w-36" />
      </div>

      <div className="grid grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-card border border-border rounded-lg p-5 space-y-3">
            <div className="skeleton h-3 w-20" />
            <div className="skeleton h-7 w-28" />
          </div>
        ))}
      </div>

      <div className="bg-card border border-border rounded-lg p-6 space-y-4">
        <div className="skeleton h-3 w-24" />
        <div className="space-y-0">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 py-3 border-b border-border last:border-0">
              <div className="skeleton h-3 w-8" />
              <div className="skeleton h-3 w-20" />
              <div className="skeleton h-3 flex-1" />
              <div className="skeleton h-3 w-24" />
              <div className="skeleton h-5 w-16 rounded-full" />
              <div className="skeleton h-3 w-20" />
              <div className="skeleton h-5 w-16 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
