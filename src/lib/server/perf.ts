type TimingEntry = {
  name: string;
  dur: number;
};

function formatDuration(value: number) {
  return Number(value.toFixed(1));
}

function formatServerTiming(entries: TimingEntry[]) {
  return entries.map((entry) => `${entry.name};dur=${formatDuration(entry.dur)}`).join(", ");
}

export function createRequestMetrics(label: string) {
  const startedAt = performance.now();
  const entries: TimingEntry[] = [];

  return {
    async track<T>(name: string, fn: () => Promise<T>) {
      const stepStart = performance.now();
      try {
        return await fn();
      } finally {
        entries.push({
          name,
          dur: performance.now() - stepStart
        });
      }
    },
    headers(init?: HeadersInit) {
      const headers = new Headers(init);
      const total = performance.now() - startedAt;
      const finalEntries = [...entries, { name: "total", dur: total }];
      headers.set("Server-Timing", formatServerTiming(finalEntries));
      headers.set("x-perf-total-ms", String(formatDuration(total)));
      return headers;
    },
    log(extra?: Record<string, unknown>) {
      const total = performance.now() - startedAt;
      console.info(
        `[perf] ${label} total=${formatDuration(total)}ms timings=${JSON.stringify(
          entries.map((entry) => ({
            ...entry,
            dur: formatDuration(entry.dur)
          }))
        )}${extra ? ` meta=${JSON.stringify(extra)}` : ""}`
      );
    }
  };
}

export async function measureAsync<T>(label: string, fn: () => Promise<T>, extra?: Record<string, unknown>) {
  const startedAt = performance.now();
  try {
    return await fn();
  } finally {
    console.info(
      `[perf] ${label} total=${formatDuration(performance.now() - startedAt)}ms${extra ? ` meta=${JSON.stringify(extra)}` : ""}`
    );
  }
}
