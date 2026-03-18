export default function GearWallLoading() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-panel p-4">
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-9 w-20 animate-pulse rounded-full bg-panel" />
          ))}
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="rounded-3xl border border-border bg-panel p-4">
            <div className="aspect-square animate-pulse rounded-2xl bg-panel" />
            <div className="mt-4 space-y-3">
              <div className="h-5 w-2/3 animate-pulse rounded-lg bg-panel" />
              <div className="h-4 w-1/2 animate-pulse rounded-lg bg-panel" />
              <div className="h-4 w-5/6 animate-pulse rounded-lg bg-panel" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
