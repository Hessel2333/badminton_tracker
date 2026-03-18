export default function SettingsLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-7 w-24 animate-pulse rounded-xl bg-panel" />
        <div className="h-4 w-72 animate-pulse rounded-lg bg-panel" />
      </div>

      <div className="rounded-2xl border border-border bg-panel p-6">
        <div className="mb-4 flex gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-9 w-24 animate-pulse rounded-full bg-panel" />
          ))}
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-2xl bg-panel" />
          ))}
        </div>
      </div>
    </div>
  );
}
