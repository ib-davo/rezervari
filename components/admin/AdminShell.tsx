"use client";

import { useState } from "react";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import { Menu } from "lucide-react";

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-100">
      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />

      <div className="lg:pl-64">
        <TopBar onMenuClick={() => setMobileOpen(true)} />
        <main className="p-4 sm:p-6 lg:p-8">{children}</main>
      </div>

      <button
        onClick={() => setMobileOpen(true)}
        aria-label="Deschide meniu"
        className="fixed bottom-6 right-6 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-orange-500 text-white shadow-lg shadow-orange-500/30 lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>
    </div>
  );
}
