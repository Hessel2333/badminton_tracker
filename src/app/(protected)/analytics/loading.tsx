export default function AnalyticsLoading() {
    return (
        <div className="space-y-6">
            {/* Section title skeleton */}
            <div className="space-y-2">
                <div className="h-7 w-28 animate-pulse rounded-xl bg-panel" />
                <div className="h-4 w-72 animate-pulse rounded-lg bg-panel" />
            </div>

            {/* Header card with range selector */}
            <div className="rounded-2xl bg-card p-6 shadow-card">
                <div className="flex items-center justify-between">
                    <div className="space-y-2">
                        <div className="h-6 w-24 animate-pulse rounded-lg bg-panel" />
                        <div className="h-4 w-48 animate-pulse rounded-lg bg-panel" />
                    </div>
                    <div className="h-9 w-36 animate-pulse rounded-xl bg-panel" />
                </div>
                <div className="mt-3 h-4 w-40 animate-pulse rounded-lg bg-panel" />
            </div>

            {/* Charts grid */}
            <div className="grid gap-4 xl:grid-cols-2">
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="rounded-2xl bg-card p-6 shadow-card">
                        <div className="mb-2 h-5 w-28 animate-pulse rounded-lg bg-panel" />
                        <div className="h-80 animate-pulse rounded-2xl bg-panel" />
                    </div>
                ))}
            </div>

            {/* Bottom cards */}
            <div className="grid gap-4 xl:grid-cols-2">
                {[1, 2].map((i) => (
                    <div key={i} className="rounded-2xl bg-card p-6 shadow-card">
                        <div className="mb-3 h-5 w-32 animate-pulse rounded-lg bg-panel" />
                        <div className="space-y-3">
                            {[1, 2, 3].map((j) => (
                                <div key={j} className="h-8 animate-pulse rounded-xl bg-panel" />
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
