"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Users, Plus, Pencil, Trash2, Check, X, ShieldCheck, Loader2, AlertTriangle, KeyRound,
} from "lucide-react";

type Operator = {
  id: string;
  name: string;
  slug: string;
  role: "operator" | "supervisor";
  active: boolean;
  lastLogin: string | null;
  _count: { bookings: number };
};

const dtFmt = new Intl.DateTimeFormat("ro-RO", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export default function OperatoriPage() {
  const router = useRouter();
  const [ops, setOps] = useState<Operator[]>([]);
  const [meId, setMeId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // adăugare
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [role, setRole] = useState<"operator" | "supervisor">("operator");
  const [adding, setAdding] = useState(false);

  const [editId, setEditId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/operator/admin/operators", { cache: "no-store" });
      if (res.status === 403) { setForbidden(true); return; }
      const d = await res.json();
      if (d?.success) { setOps(d.operators); setMeId(d.meId); }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const add = async () => {
    setErr(null); setAdding(true);
    try {
      const res = await fetch("/api/operator/admin/operators", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), pin: pin.trim(), role }),
      });
      const d = await res.json();
      if (!d.success) { setErr(d.error || "Eroare"); return; }
      setName(""); setPin(""); setRole("operator");
      load();
    } finally {
      setAdding(false);
    }
  };

  if (forbidden) {
    return (
      <div className="rounded-2xl border border-[color:var(--ink-200)] bg-white px-4 py-14 text-center">
        <ShieldCheck className="mx-auto h-8 w-8 text-[color:var(--ink-300)]" />
        <p className="mt-3 text-sm font-semibold text-[color:var(--navy-900)]">Doar supervizorul poate gestiona operatorii.</p>
        <button onClick={() => router.replace("/panou")} className="mt-3 text-xs font-semibold text-[color:var(--red-500)] hover:underline">Înapoi</button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <Users className="h-5 w-5 text-[color:var(--navy-900)]" />
        <h1 className="text-lg font-extrabold text-[color:var(--navy-900)]">Operatori</h1>
        <span className="rounded-full bg-[color:var(--navy-50)] px-2 py-0.5 text-xs font-bold text-[color:var(--navy-900)]">{ops.length}</span>
      </div>

      {/* Adaugă operator */}
      <div className="mb-4 rounded-2xl border border-[color:var(--ink-200)] bg-white p-3 sm:p-4">
        <div className="mb-2 text-sm font-bold text-[color:var(--navy-900)]">Adaugă operator</div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex-1 min-w-[10rem]">
            <span className="mb-1 block text-[11px] font-semibold text-[color:var(--ink-500)]">Nume</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Vasile"
              className="w-full rounded-lg border border-[color:var(--ink-200)] px-3 py-2 text-sm outline-none focus:border-[color:var(--navy-700)]" />
          </label>
          <label className="w-28">
            <span className="mb-1 block text-[11px] font-semibold text-[color:var(--ink-500)]">PIN (4 cifre)</span>
            <input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" placeholder="1234"
              className="w-full rounded-lg border border-[color:var(--ink-200)] px-3 py-2 text-sm tracking-widest outline-none focus:border-[color:var(--navy-700)]" />
          </label>
          <label className="w-36">
            <span className="mb-1 block text-[11px] font-semibold text-[color:var(--ink-500)]">Rol</span>
            <select value={role} onChange={(e) => setRole(e.target.value as "operator" | "supervisor")}
              className="w-full rounded-lg border border-[color:var(--ink-200)] px-3 py-2 text-sm outline-none focus:border-[color:var(--navy-700)]">
              <option value="operator">Operator</option>
              <option value="supervisor">Supervizor</option>
            </select>
          </label>
          <button onClick={add} disabled={adding || !name.trim() || pin.length !== 4}
            className="inline-flex items-center gap-1 rounded-lg bg-[color:var(--red-500)] px-4 py-2 text-sm font-semibold text-white active:scale-95 transition-transform disabled:opacity-50 hover:bg-[color:var(--red-600)]">
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Adaugă
          </button>
        </div>
        {err && <div className="mt-2 flex items-center gap-1 text-xs font-semibold text-red-600"><AlertTriangle className="h-3.5 w-3.5" /> {err}</div>}
      </div>

      {/* Lista */}
      {loading ? (
        <div className="rounded-2xl border border-[color:var(--ink-200)] bg-white p-10 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-[color:var(--ink-300)]" /></div>
      ) : (
        <div className="space-y-2">
          {ops.map((op) => (
            <OperatorRow key={op.id} op={op} isMe={op.id === meId} editing={editId === op.id}
              onEdit={() => setEditId(op.id)} onClose={() => setEditId(null)} onChanged={load} />
          ))}
        </div>
      )}
    </div>
  );
}

function OperatorRow({ op, isMe, editing, onEdit, onClose, onChanged }: {
  op: Operator; isMe: boolean; editing: boolean; onEdit: () => void; onClose: () => void; onChanged: () => void;
}) {
  const [name, setName] = useState(op.name);
  const [pin, setPin] = useState("");
  const [role, setRole] = useState(op.role);
  const [active, setActive] = useState(op.active);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);

  const save = async () => {
    setBusy(true); setErr(null);
    try {
      const res = await fetch(`/api/operator/admin/operators/${op.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), pin: pin.trim() || undefined, role, active }),
      });
      const d = await res.json();
      if (!d.success) { setErr(d.error || "Eroare"); return; }
      setPin(""); onClose(); onChanged();
    } finally { setBusy(false); }
  };

  const del = async () => {
    setBusy(true); setErr(null);
    try {
      const res = await fetch(`/api/operator/admin/operators/${op.id}`, { method: "DELETE" });
      const d = await res.json();
      if (!d.success) { setErr(d.error || "Eroare"); setConfirmDel(false); return; }
      onChanged();
    } finally { setBusy(false); }
  };

  return (
    <div className="rounded-2xl border border-[color:var(--ink-200)] bg-white p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-[color:var(--navy-900)]">{op.name}</span>
            {op.role === "supervisor" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--navy-900)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                <ShieldCheck className="h-3 w-3" /> Supervizor
              </span>
            )}
            {isMe && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">Tu</span>}
            {!op.active && <span className="rounded-full bg-[color:var(--ink-100)] px-2 py-0.5 text-[10px] font-bold text-[color:var(--ink-500)]">Inactiv</span>}
          </div>
          <div className="mt-0.5 text-[11px] text-[color:var(--ink-500)]">
            <span className="font-mono">{op.slug}</span>
            {" · "}{op._count.bookings} rezervări
            {op.lastLogin ? ` · ultima intrare ${dtFmt.format(new Date(op.lastLogin))}` : " · niciodată logat"}
          </div>
        </div>
        {!editing && (
          <div className="flex shrink-0 items-center gap-1">
            <button onClick={onEdit} title="Editează" className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[color:var(--ink-200)] text-[color:var(--navy-900)] active:scale-95 transition-transform">
              <Pencil className="h-3.5 w-3.5" />
            </button>
            {!isMe && (
              confirmDel ? (
                <span className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-700">
                  Sigur?
                  <button onClick={del} disabled={busy} className="rounded bg-red-600 px-1.5 py-0.5 text-white">Da</button>
                  <button onClick={() => setConfirmDel(false)} className="px-1">Nu</button>
                </span>
              ) : (
                <button onClick={() => setConfirmDel(true)} title="Șterge" className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 text-red-600 active:scale-95 transition-transform">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )
            )}
          </div>
        )}
      </div>

      {editing && (
        <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-[color:var(--ink-100)] pt-3">
          <label className="flex-1 min-w-[9rem]">
            <span className="mb-1 block text-[11px] font-semibold text-[color:var(--ink-500)]">Nume</span>
            <input value={name} onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-[color:var(--ink-200)] px-3 py-2 text-sm outline-none focus:border-[color:var(--navy-700)]" />
          </label>
          <label className="w-32">
            <span className="mb-1 block flex items-center gap-1 text-[11px] font-semibold text-[color:var(--ink-500)]"><KeyRound className="h-3 w-3" /> PIN nou</span>
            <input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" placeholder="lasă gol"
              className="w-full rounded-lg border border-[color:var(--ink-200)] px-3 py-2 text-sm tracking-widest outline-none focus:border-[color:var(--navy-700)]" />
          </label>
          <label className="w-36">
            <span className="mb-1 block text-[11px] font-semibold text-[color:var(--ink-500)]">Rol</span>
            <select value={role} onChange={(e) => setRole(e.target.value as "operator" | "supervisor")}
              className="w-full rounded-lg border border-[color:var(--ink-200)] px-3 py-2 text-sm outline-none focus:border-[color:var(--navy-700)]">
              <option value="operator">Operator</option>
              <option value="supervisor">Supervizor</option>
            </select>
          </label>
          <label className="inline-flex items-center gap-2 rounded-lg border border-[color:var(--ink-200)] px-3 py-2 text-sm font-semibold text-[color:var(--navy-900)]">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Activ
          </label>
          <button onClick={save} disabled={busy || !name.trim()} className="inline-flex items-center gap-1 rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-white active:scale-95 transition-transform disabled:opacity-50">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Salvează
          </button>
          <button onClick={onClose} className="inline-flex items-center gap-1 rounded-lg border border-[color:var(--ink-200)] px-3 py-2 text-sm font-semibold text-[color:var(--ink-500)]">
            <X className="h-4 w-4" /> Anulează
          </button>
          {err && <div className="w-full flex items-center gap-1 text-xs font-semibold text-red-600"><AlertTriangle className="h-3.5 w-3.5" /> {err}</div>}
        </div>
      )}
      {!editing && err && <div className="mt-2 flex items-center gap-1 text-xs font-semibold text-red-600"><AlertTriangle className="h-3.5 w-3.5" /> {err}</div>}
    </div>
  );
}
