import { Card } from "@/components/ui/Card";

export function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="flex flex-col gap-1 transition-transform active:scale-[0.98]">
      <p className="text-[11px] font-bold uppercase tracking-wider text-mute opacity-80">{label}</p>
      <p className="text-3xl font-semibold tracking-tight text-text">{value}</p>
      {hint ? <p className="text-xs text-mute/70">{hint}</p> : null}
    </Card>
  );
}
