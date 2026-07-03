import { cn } from "@/lib/utils";

type Tone = "orange" | "blue" | "green" | "purple" | "slate" | "red";

const toneBg: Record<Tone, string> = {
  orange: "bg-orange-50 text-orange-600",
  blue: "bg-blue-50 text-blue-600",
  green: "bg-emerald-50 text-emerald-600",
  purple: "bg-purple-50 text-purple-600",
  slate: "bg-slate-100 text-slate-600",
  red: "bg-red-50 text-red-600",
};

export default function StatCard({
  label,
  value,
  delta,
  icon: Icon,
  tone = "orange",
  hint,
}: {
  label: string;
  value: React.ReactNode;
  delta?: { value: string; positive?: boolean };
  icon?: React.ComponentType<{ className?: string }>;
  tone?: Tone;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
            {label}
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
          {delta && (
            <p
              className={cn(
                "mt-1 text-xs font-semibold",
                delta.positive ? "text-emerald-600" : "text-red-600"
              )}
            >
              {delta.positive ? "▲" : "▼"} {delta.value}
            </p>
          )}
          {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
        </div>
        {Icon && (
          <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", toneBg[tone])}>
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
    </div>
  );
}
