"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock, LogIn } from "lucide-react";

function LoginInner() {
  const router = useRouter();
  const next = useSearchParams().get("next") ?? "/admin";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error ?? "Eroare la autentificare");
        return;
      }
      router.push(next);
      router.refresh();
    } catch {
      setError("Eroare de rețea");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white shadow-xl">
      <div className="border-b border-slate-100 px-6 py-5 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-red-500 text-lg font-black text-white shadow-sm">
          D
        </div>
        <h1 className="mt-3 text-lg font-bold text-slate-900">DAVO Admin</h1>
        <p className="text-xs text-slate-500">Autentificare operator</p>
      </div>
      <div className="space-y-4 px-6 py-5">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">Email</span>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-200"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-500">Parolă</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-200"
          />
        </label>
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>
        )}
        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-600 disabled:opacity-60"
        >
          <LogIn className="h-4 w-4" />
          {loading ? "Se verifică…" : "Autentificare"}
        </button>
      </div>
      <div className="border-t border-slate-100 px-6 py-3 text-center text-[11px] text-slate-400">
        <Lock className="mr-1 inline h-3 w-3" />
        Conexiune securizată · doar personal autorizat
      </div>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 via-slate-50 to-orange-50 p-4">
      <Suspense fallback={null}>
        <LoginInner />
      </Suspense>
    </div>
  );
}
