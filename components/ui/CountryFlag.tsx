import { cn } from "@/lib/utils";

export type CountryCode = "gb" | "de" | "be" | "nl" | "lu" | "md";

export function CountryFlag({
  code,
  className,
  rounded = "md",
}: {
  code: CountryCode;
  className?: string;
  rounded?: "sm" | "md" | "lg" | "full";
}) {
  const radius = {
    sm: "rounded",
    md: "rounded-md",
    lg: "rounded-xl",
    full: "rounded-full",
  }[rounded];

  return (
    <span
      className={cn(
        "relative inline-block overflow-hidden shadow-[0_4px_14px_-6px_rgb(15_23_42_/_0.25)] ring-1 ring-black/5",
        radius,
        className
      )}
      aria-hidden
    >
      {flags[code]}
    </span>
  );
}

const flags: Record<CountryCode, React.ReactNode> = {
  gb: (
    <svg viewBox="0 0 60 40" className="h-full w-full" preserveAspectRatio="xMidYMid slice">
      <rect width="60" height="40" fill="#012169" />
      <path d="M0 0 L60 40 M60 0 L0 40" stroke="#fff" strokeWidth="8" />
      <path d="M0 0 L60 40 M60 0 L0 40" stroke="#C8102E" strokeWidth="4" />
      <path d="M30 0 V40 M0 20 H60" stroke="#fff" strokeWidth="10" />
      <path d="M30 0 V40 M0 20 H60" stroke="#C8102E" strokeWidth="6" />
    </svg>
  ),
  de: (
    <svg viewBox="0 0 60 40" className="h-full w-full" preserveAspectRatio="xMidYMid slice">
      <rect width="60" height="13.33" fill="#000" />
      <rect y="13.33" width="60" height="13.34" fill="#DD0000" />
      <rect y="26.67" width="60" height="13.33" fill="#FFCE00" />
    </svg>
  ),
  be: (
    <svg viewBox="0 0 60 40" className="h-full w-full" preserveAspectRatio="xMidYMid slice">
      <rect width="20" height="40" fill="#000" />
      <rect x="20" width="20" height="40" fill="#FAE042" />
      <rect x="40" width="20" height="40" fill="#ED2939" />
    </svg>
  ),
  nl: (
    <svg viewBox="0 0 60 40" className="h-full w-full" preserveAspectRatio="xMidYMid slice">
      <rect width="60" height="13.33" fill="#AE1C28" />
      <rect y="13.33" width="60" height="13.34" fill="#fff" />
      <rect y="26.67" width="60" height="13.33" fill="#21468B" />
    </svg>
  ),
  lu: (
    <svg viewBox="0 0 60 40" className="h-full w-full" preserveAspectRatio="xMidYMid slice">
      <rect width="60" height="13.33" fill="#ED2939" />
      <rect y="13.33" width="60" height="13.34" fill="#fff" />
      <rect y="26.67" width="60" height="13.33" fill="#00A1DE" />
    </svg>
  ),
  md: (
    <svg viewBox="0 0 60 40" className="h-full w-full" preserveAspectRatio="xMidYMid slice">
      <rect width="20" height="40" fill="#003DA5" />
      <rect x="20" width="20" height="40" fill="#FFD200" />
      <rect x="40" width="20" height="40" fill="#CF142B" />
    </svg>
  ),
};

export const countryMeta: Record<
  CountryCode,
  { label: string; destinationSlug: string; subtitle: string }
> = {
  gb: { label: "Anglia", destinationSlug: "anglia", subtitle: "Canterbury → Manchester" },
  de: { label: "Germania", destinationSlug: "germania", subtitle: "München → Hannover" },
  be: { label: "Belgia", destinationSlug: "belgia", subtitle: "Bruxelles → Antwerpen" },
  nl: { label: "Olanda", destinationSlug: "olanda", subtitle: "Amsterdam → Rotterdam" },
  lu: { label: "Luxembourg", destinationSlug: "luxemburg", subtitle: "Luxembourg City" },
  md: { label: "Moldova", destinationSlug: "", subtitle: "Chișinău → Bălți" },
};

export const destinationSlugToCode: Record<string, CountryCode> = {
  anglia: "gb",
  germania: "de",
  belgia: "be",
  olanda: "nl",
  luxemburg: "lu",
};
