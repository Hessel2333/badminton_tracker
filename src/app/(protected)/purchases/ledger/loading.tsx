export default function PurchasesLedgerLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-7 w-32 animate-pulse rounded-xl bg-panel" />
        <div className="h-4 w-64 animate-pulse rounded-lg bg-panel" />
      </div>
      <div className="rounded-2xl border border-border bg-panel p-6">
        <div className="mb-4 h-6 w-20 animate-pulse rounded-lg bg-panel" />
        <div className="space-y-3">
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded-xl bg-panel" />
          ))}
        </div>
      </div>
    </div>
  );
}

