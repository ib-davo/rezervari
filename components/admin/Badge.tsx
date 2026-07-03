import { cn } from "@/lib/utils";

type Variant =
  | "slate"
  | "green"
  | "yellow"
  | "red"
  | "blue"
  | "purple"
  | "orange";

const variants: Record<Variant, string> = {
  slate: "bg-slate-100 text-slate-700",
  green: "bg-emerald-100 text-emerald-700",
  yellow: "bg-yellow-100 text-yellow-800",
  red: "bg-red-100 text-red-700",
  blue: "bg-blue-100 text-blue-700",
  purple: "bg-purple-100 text-purple-700",
  orange: "bg-orange-100 text-orange-700",
};

export default function Badge({
  children,
  variant = "slate",
  className,
}: {
  children: React.ReactNode;
  variant?: Variant;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold",
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
