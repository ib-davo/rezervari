"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Menu, Search, Bell, LogOut } from "lucide-react";

export default function TopBar({ onMenuClick }: { onMenuClick: () => void }) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function logout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur sm:px-6 lg:px-8">
      <button
        onClick={onMenuClick}
        aria-label="Deschide meniu"
        className="rounded-md p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="relative hidden flex-1 sm:block max-w-xl">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          placeholder="Caută rezervări, clienți, rute…"
          className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm placeholder:text-slate-400 focus:border-orange-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-200"
        />
      </div>

      <div className="ml-auto flex items-center gap-1 sm:gap-2">
        <button
          aria-label="Notificări"
          className="relative rounded-md p-2 text-slate-500 hover:bg-slate-100"
        >
          <Bell className="h-4 w-4" />
          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-orange-500" />
        </button>

        <div className="hidden items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 sm:flex">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-[11px] font-bold text-white">
            DA
          </div>
          <div className="leading-tight">
            <div className="text-xs font-semibold text-slate-900">Admin DAVO</div>
            <div className="text-[10px] text-slate-500">operator · Chișinău</div>
          </div>
        </div>

        <button
          onClick={logout}
          disabled={loggingOut}
          className="flex items-center gap-1.5 rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-60"
          title="Ieșire"
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden text-sm sm:inline">{loggingOut ? "Ieșire…" : "Ieșire"}</span>
        </button>
      </div>
    </header>
  );
}
