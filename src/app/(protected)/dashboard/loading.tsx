export default function DashboardLoading() {
    return (
        <div className="space-y-6">
            {/* Stat cards row */}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="rounded-2xl bg-panel border border-border p-5">
                        <div className="mb-2 h-4 w-24 animate-pulse rounded-lg bg-panel" />
                        <div className="h-8 w-32 animate-pulse rounded-xl bg-panel" />
                    </div>
                ))}
            </div>

            {/* Recent purchases card */}
            <div className="rounded-2xl bg-panel border border-border p-6">
                <div className="mb-4 h-6 w-28 animate-pulse rounded-lg bg-panel" />
                <div className="space-y-3">
                    {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="h-10 animate-pulse rounded-xl bg-panel" />
                    ))}
                </div>
            </div>
        </div>
    );
}
