import { cn } from "@/lib/utils";

type Tone = "neutral" | "warm" | "cool" | "success" | "danger";

const toneClasses: Record<Tone, string> = {
  neutral: "bg-slate-100 text-slate",
  warm: "bg-orange/10 text-orange",
  cool: "bg-indigo/10 text-indigo",
  success: "bg-emerald-50 text-emerald-600",
  danger: "bg-crimson/10 text-crimson",
};

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium font-mono tracking-tight",
        toneClasses[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
