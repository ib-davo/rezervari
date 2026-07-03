"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Delete, LogIn, User, ShieldCheck } from "lucide-react";

type Op = { slug: string; name: string };

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/panou";

  const [operators, setOperators] = useState<Op[]>([]);
  const [slug, setSlug] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/operator/list")
      .then((r) => r.json())
      .then((d) => d?.success && setOperators(d.operators))
      .catch(() => {});
  }, []);

  const submit = async (finalPin: string) => {
    if (!slug || finalPin.length !== 4) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/operator/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, pin: finalPin }),
      });
      const data = await res.json();
      if (data.success) {
        router.replace(next);
        router.refresh();
      } else {
        setError(data.error || "PIN incorect");
        setPin("");
      }
    } catch {
      setError("Eroare de rețea");
      setPin("");
    } finally {
      setBusy(false);
    }
  };

  const press = (d: string) => {
    if (busy) return;
    setError(null);
    const nextPin = (pin + d).slice(0, 4);
    setPin(nextPin);
    if (nextPin.length === 4) submit(nextPin);
  };
  const del = () => setPin((p) => p.slice(0, -1));

  const selected = operators.find((o) => o.slug === slug);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[color:var(--ink-50)]">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[color:var(--navy-900)] text-white mb-3">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-extrabold text-[color:var(--navy-900)]">Panou operatori</h1>
          <p className="text-sm text-[color:var(--ink-500)] mt-1">DAVO Group — rezervări</p>
        </div>

        {!slug ? (
          <div className="rounded-2xl bg-white border border-[color:var(--ink-200)] p-4">
            <div className="text-[11px] font-bold uppercase tracking-widest text-[color:var(--ink-500)] mb-3 px-1">
              Cine ești?
            </div>
            <div className="grid grid-cols-2 gap-2">
              {operators.map((o) => (
                <button
                  key={o.slug}
                  onClick={() => { setSlug(o.slug); setPin(""); setError(null); }}
                  className="flex items-center gap-2 rounded-xl border border-[color:var(--ink-200)] bg-white px-3 py-3 text-sm font-semibold text-[color:var(--navy-900)] hover:border-[color:var(--red-500)] hover:bg-[color:var(--red-50)] transition-colors"
                >
                  <User className="h-4 w-4 text-[color:var(--red-500)]" />
                  {o.name}
                </button>
              ))}
              {operators.length === 0 && (
                <div className="col-span-2 text-center text-sm text-[color:var(--ink-500)] py-6">
                  Se încarcă operatorii…
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl bg-white border border-[color:var(--ink-200)] p-5">
            <button
              onClick={() => { setSlug(null); setPin(""); setError(null); }}
              className="text-xs font-semibold text-[color:var(--ink-500)] hover:text-[color:var(--navy-900)] mb-3"
            >
              ← Schimbă operatorul
            </button>
            <div className="text-center mb-4">
              <div className="text-lg font-extrabold text-[color:var(--navy-900)]">{selected?.name}</div>
              <div className="text-xs text-[color:var(--ink-500)]">Introdu PIN-ul (4 cifre)</div>
            </div>

            <div className="flex justify-center gap-3 mb-5">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`h-4 w-4 rounded-full transition-colors ${
                    i < pin.length ? "bg-[color:var(--red-500)]" : "bg-[color:var(--ink-200)]"
                  }`}
                />
              ))}
            </div>

            {error && <div className="text-center text-sm text-red-600 mb-3">{error}</div>}

            <div className="grid grid-cols-3 gap-2.5">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
                <PinKey key={d} onClick={() => press(d)} disabled={busy}>{d}</PinKey>
              ))}
              <div />
              <PinKey onClick={() => press("0")} disabled={busy}>0</PinKey>
              <PinKey onClick={del} disabled={busy} variant="muted">
                <Delete className="h-5 w-5 mx-auto" />
              </PinKey>
            </div>

            {busy && (
              <div className="flex items-center justify-center gap-2 text-sm text-[color:var(--ink-500)] mt-4">
                <LogIn className="h-4 w-4 animate-pulse" /> Se verifică…
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function PinKey({
  children,
  onClick,
  disabled,
  variant = "normal",
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  variant?: "normal" | "muted";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`h-14 rounded-xl text-xl font-bold transition-colors disabled:opacity-50 ${
        variant === "muted"
          ? "text-[color:var(--ink-500)] hover:bg-[color:var(--ink-100)]"
          : "bg-[color:var(--ink-50)] text-[color:var(--navy-900)] hover:bg-[color:var(--navy-50)] border border-[color:var(--ink-200)]"
      }`}
    >
      {children}
    </button>
  );
}

export default function OperatorLoginPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center">Se încarcă…</div>}>
      <LoginInner />
    </Suspense>
  );
}
