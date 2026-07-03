"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Plus, ListChecks, Archive, ShieldCheck } from "lucide-react";

export default function PanouLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [name, setName] = useState<string>("");

  useEffect(() => {
    fetch("/api/operator/me")
      .then((r) => r.json())
      .then((d) => {
        if (d?.success) setName(d.operator.name);
        else router.replace("/panou/login");
      })
      .catch(() => {});
  }, [router]);

  const logout = async () => {
    await fetch("/api/operator/logout", { method: "POST" });
    router.replace("/panou/login");
    router.refresh();
  };

  const tabs = [
    { href: "/panou", label: "Active", icon: ListChecks },
    { href: "/panou/arhiva", label: "Arhivă", icon: Archive },
  ];

  return (
    <div className="min-h-screen bg-[color:var(--ink-50)]">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-[color:var(--ink-200)] bg-white/95 backdrop-blur">
        <div className="mx-auto max-w-7xl px-3 sm:px-4 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[color:var(--navy-900)] text-white">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="leading-tight min-w-0">
              <div className="font-extrabold text-[color:var(--navy-900)] truncate">DAVO · Operatori</div>
              <div className="text-[11px] text-[color:var(--ink-500)] truncate">{name ? name : "…"}</div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {/* Buton mare doar pe desktop — pe telefon e în bara de jos */}
            <Link
              href="/panou/rezervare"
              className="hidden md:inline-flex items-center gap-2 rounded-full bg-[color:var(--red-500)] px-4 py-2 text-sm font-semibold text-white hover:bg-[color:var(--red-600)] transition-colors"
            >
              <Plus className="h-4 w-4" /> Rezervare nouă
            </Link>
            <button
              onClick={logout}
              className="inline-flex items-center gap-2 rounded-full border border-[color:var(--ink-200)] px-3 py-2 text-sm font-semibold text-[color:var(--navy-900)] active:scale-95 transition-transform"
            >
              <LogOut className="h-4 w-4" /> <span className="hidden sm:inline">Ieși</span>
            </button>
          </div>
        </div>
        {/* Tab-uri sus — doar desktop */}
        <div className="hidden md:flex mx-auto max-w-7xl px-4 gap-1 -mb-px">
          {tabs.map((t) => {
            const active = pathname === t.href;
            return (
              <Link
                key={t.href}
                href={t.href}
                className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
                  active
                    ? "border-[color:var(--red-500)] text-[color:var(--navy-900)]"
                    : "border-transparent text-[color:var(--ink-500)] hover:text-[color:var(--navy-900)]"
                }`}
              >
                <t.icon className="h-4 w-4" /> {t.label}
              </Link>
            );
          })}
        </div>
      </header>

      {/* Conținut — padding jos pe mobil ca să nu intre sub bara fixă */}
      <main className="mx-auto max-w-7xl px-3 sm:px-4 py-4 sm:py-6 pb-28 md:pb-8">{children}</main>

      {/* Bară de navigare jos — doar mobil (thumb-friendly) */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-[color:var(--ink-200)] bg-white/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
        <div className="grid grid-cols-3 items-end">
          <BottomTab href="/panou" label="Active" icon={ListChecks} active={pathname === "/panou"} />
          <BottomFab href="/panou/rezervare" active={pathname === "/panou/rezervare"} />
          <BottomTab href="/panou/arhiva" label="Arhivă" icon={Archive} active={pathname === "/panou/arhiva"} />
        </div>
      </nav>
    </div>
  );
}

function BottomTab({
  href, label, icon: Icon, active,
}: {
  href: string;
  label: string;
  icon: typeof ListChecks;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex flex-col items-center justify-center gap-0.5 py-2.5 text-[11px] font-semibold transition-colors ${
        active ? "text-[color:var(--red-500)]" : "text-[color:var(--ink-500)]"
      }`}
    >
      <Icon className="h-5 w-5" />
      {label}
    </Link>
  );
}

function BottomFab({ href, active }: { href: string; active: boolean }) {
  return (
    <div className="flex justify-center">
      <Link
        href={href}
        aria-label="Rezervare nouă"
        className={`-mt-6 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg shadow-red-500/30 active:scale-95 transition-transform ${
          active ? "bg-[color:var(--red-600)] ring-4 ring-[color:var(--red-100)]" : "bg-[color:var(--red-500)]"
        }`}
      >
        <Plus className="h-7 w-7" />
      </Link>
    </div>
  );
}
