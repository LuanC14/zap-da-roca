export default function Loading() {
  return (
    <div className="space-y-8 max-w-5xl">
      <div className="flex items-end justify-between">
        <div className="space-y-2">
          <div className="skeleton h-3 w-14" />
          <div className="skeleton h-8 w-40" />
        </div>
        <div className="skeleton h-3 w-48" />
      </div>

      <div className="bg-card border border-border rounded-lg p-6 space-y-4">
        <div className="skeleton h-3 w-32" />
        <div className="space-y-0">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 py-3 border-b border-border last:border-0">
              <div className="skeleton h-3 w-32" />
              <div className="skeleton h-3 w-20 ml-auto" />
              <div className="skeleton h-3 w-16" />
              <div className="skeleton h-3 w-28" />
              <div className="skeleton h-3 w-20" />
              <div className="skeleton h-5 w-14 rounded-full" />
              <div className="skeleton h-3 w-20" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
