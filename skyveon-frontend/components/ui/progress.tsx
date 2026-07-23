import { cn } from "@/lib/utils";

export function ProgressBar({
  percent,
  className,
  showLabel = false,
}: {
  percent: number;
  className?: string;
  showLabel?: boolean;
}) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="relative h-2 flex-1 rounded-full bg-slate-100 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-crimson via-orange to-violet transition-all duration-500"
          style={{ width: `${clamped}%` }}
        />
        {clamped > 0 && clamped < 100 && (
          <div
            className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rotate-45 bg-violet"
            style={{ left: `calc(${clamped}% - 6px)` }}
          />
        )}
      </div>
      {showLabel && (
        <span className="font-mono text-xs text-slate w-9 text-right">
          {clamped}%
        </span>
      )}
    </div>
  );
}

export function ProgressRing({
  percent,
  size = 88,
  label,
}: {
  percent: number;
  size?: number;
  label?: string;
}) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div
      className="relative flex items-center justify-center rounded-full"
      style={{
        width: size,
        height: size,
        background: `conic-gradient(#2E3192 ${clamped * 3.6}deg, #F1F2F8 0deg)`,
      }}
    >
      <div
        className="absolute rounded-full bg-white flex flex-col items-center justify-center"
        style={{ width: size - 14, height: size - 14 }}
      >
        <span className="font-display font-semibold text-lg text-ink">
          {clamped}%
        </span>
        {label && <span className="text-[10px] text-slate">{label}</span>}
      </div>
    </div>
  );
}
