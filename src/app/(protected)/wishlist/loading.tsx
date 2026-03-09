export default function WishlistLoading() {
    return (
        <div className="space-y-6">
            {/* Section title skeleton */}
            <div className="space-y-2">
                <div className="h-7 w-24 animate-pulse rounded-xl bg-panel" />
                <div className="h-4 w-56 animate-pulse rounded-lg bg-panel" />
            </div>

            {/* Form card skeleton */}
            <div className="rounded-2xl bg-card p-6 shadow-card">
                <div className="mb-4 h-6 w-28 animate-pulse rounded-lg bg-panel" />
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="space-y-1">
                            <div className="h-3 w-16 animate-pulse rounded bg-panel" />
                            <div className="h-10 animate-pulse rounded-xl bg-panel" />
                        </div>
                    ))}
                </div>
            </div>

            {/* List card skeleton */}
            <div className="rounded-2xl bg-card p-6 shadow-card">
                <div className="mb-4 h-6 w-20 animate-pulse rounded-lg bg-panel" />
                <div className="space-y-3">
                    {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="h-16 animate-pulse rounded-xl bg-panel" />
                    ))}
                </div>
            </div>
        </div>
    );
}
