"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Route as RouteIcon,
  Bus as BusIcon,
  CalendarClock,
  Ticket,
  Users,
  Mail,
  Settings,
  Globe,
  X,
  Armchair,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { canAccessUI, type Role } from "@/lib/permissions";

type NavItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
};

const navGroups: { title: string; items: NavItem[] }[] = [
  {
    title: "Operare",
    items: [
      { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
      { label: "Rezervări", href: "/admin/bookings", icon: Ticket },
      { label: "Schemă autocar", href: "/admin/seats", icon: Armchair },
      { label: "Curse", href: "/admin/trips", icon: CalendarClock },
    ],
  },
  {
    title: "Configurare",
    items: [
      { label: "Țări & program", href: "/admin/countries", icon: Globe },
      { label: "Rute", href: "/admin/routes", icon: RouteIcon },
      { label: "Autocare", href: "/admin/buses", icon: BusIcon },
      { label: "Clienți", href: "/admin/clients", icon: Users },
    ],
  },
  {
    title: "Comunicare",
    items: [
      { label: "Emailuri", href: "/admin/emails", icon: Mail },
      { label: "Setări", href: "/admin/settings", icon: Settings },
    ],
  },
];

function isActive(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(href + "/");
}

export default function Sidebar({
  mobileOpen,
  onClose,
}: {
  mobileOpen: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname() ?? "";
  const [role, setRole] = useState<Role | null>(null);

  // Fetch o singură dată: păstrăm sidebar-ul complet vizibil pe `admin` (cel
  // principal) și restrâns pe `admin2`. Cât timp nu știm rolul, afișăm tot
  // (matchează comportamentul implicit) — proxy-ul gardează oricum servere.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d?.success) return;
        setRole((d.user.role as Role) ?? "admin");
      })
      .catch(() => {
        /* fallback la "admin" — nu blocăm UI-ul */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const visibleGroups = navGroups
    .map((g) => ({
      ...g,
      items: g.items.filter((it) => (role ? canAccessUI(role, it.href) : true)),
    }))
    .filter((g) => g.items.length > 0);

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 lg:hidden"
          onClick={onClose}
          aria-hidden
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 flex flex-col border-r border-slate-200 bg-white transition-transform duration-200 lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <Link href="/admin" className="flex items-center gap-3" onClick={onClose}>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-red-500 text-sm font-black text-white shadow-sm">
              D
            </div>
            <div className="leading-tight">
              <div className="text-sm font-bold text-slate-900">DAVO Admin</div>
              <div className="text-[11px] text-slate-500">Panou operator</div>
            </div>
          </Link>
          <button
            onClick={onClose}
            aria-label="Închide meniu"
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 lg:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          {visibleGroups.map((group) => (
            <div key={group.title}>
              <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                {group.title}
              </div>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const active = isActive(pathname, item.href);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onClose}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                        active
                          ? "bg-orange-50 text-orange-700"
                          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-4 w-4 shrink-0",
                          active ? "text-orange-500" : "text-slate-400"
                        )}
                      />
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.badge && (
                        <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-semibold text-orange-700">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-slate-200 p-4">
          <div className="rounded-lg bg-slate-50 p-3 text-xs">
            <div className="font-semibold text-slate-900">Mod demo</div>
            <p className="mt-1 text-slate-500">
              Datele sunt mock. Baza de date reală se conectează în pasul următor.
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}
