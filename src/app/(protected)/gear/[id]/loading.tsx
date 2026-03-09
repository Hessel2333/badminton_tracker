export default function GearDetailLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-8 w-64 animate-pulse rounded-lg bg-panel" />
        <div className="h-4 w-40 animate-pulse rounded bg-panel" />
      </div>

      <div className="rounded-3xl border border-border bg-panel p-6">
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map((item) => (
            <div key={item} className="space-y-2">
              <div className="h-4 w-20 animate-pulse rounded bg-panel-2" />
              <div className="h-10 animate-pulse rounded-xl bg-panel-2" />
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-3xl border border-border bg-panel p-6">
        <div className="h-6 w-32 animate-pulse rounded bg-panel-2" />
        <div className="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          {[1, 2, 3, 4, 5, 6].map((item) => (
            <div key={item} className="h-10 animate-pulse rounded-xl bg-panel-2" />
          ))}
        </div>
      </div>
    </div>
  );
}
