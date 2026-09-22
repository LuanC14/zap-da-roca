export default function Loading() {
  return (
    <div className="space-y-8 max-w-3xl">
      <div className="space-y-2">
        <div className="skeleton h-3 w-14" />
        <div className="skeleton h-8 w-40" />
      </div>

      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="bg-card border border-border rounded-lg p-6 space-y-4">
          <div className="skeleton h-3 w-24" />
          {Array.from({ length: 5 }).map((_, j) => (
            <div key={j} className="flex justify-between items-center py-2 border-b border-border last:border-0">
              <div className="skeleton h-3 w-36" />
              <div className="skeleton h-5 w-16 rounded-full" />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
