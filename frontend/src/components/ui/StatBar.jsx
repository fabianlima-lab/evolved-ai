'use client';

export default function StatBar({ label, value, max = 5 }) {
  const pct = (value / max) * 100;

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-txt-muted w-20 shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-elevated rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out bg-accent"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-txt-dim w-4 text-right">{value}</span>
    </div>
  );
}
