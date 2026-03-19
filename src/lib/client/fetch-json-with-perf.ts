"use client";

function formatDuration(value: number) {
  return Number(value.toFixed(1));
}

export async function fetchJsonWithPerf<T>(url: string): Promise<T> {
  const startedAt = performance.now();
  const response = await fetch(url);
  const clientDuration = formatDuration(performance.now() - startedAt);
  const serverDuration = response.headers.get("x-perf-total-ms");

  console.info(
    `[perf] fetch ${url} client=${clientDuration}ms${serverDuration ? ` server=${serverDuration}ms` : ""}`
  );

  return response.json() as Promise<T>;
}
