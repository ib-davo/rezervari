"use client";

import { useState } from "react";
import { ChevronDown, Loader2 } from "lucide-react";

/**
 * O SINGURĂ stare per pasager, în loc de 3 butoane + badge separat de îmbarcare.
 * „Îmbarcat" e ultima treaptă a aceleiași scări: operatorul îl vede scris în
 * dropdown, nu dedus din faptul că a apărut „achitat".
 */
export type PassengerState = "" | "confirmed" | "no_answer" | "cancelled" | "boarded";

export const PASSENGER_STATES: { v: PassengerState; label: string; cls: string }[] = [
  { v: "", label: "Necontactat", cls: "border-[color:var(--ink-200)] bg-[color:var(--ink-50)] text-[color:var(--ink-500)]" },
  { v: "confirmed", label: "Confirmat", cls: "border-emerald-500 bg-emerald-500 text-white" },
  { v: "no_answer", label: "Nu răspunde", cls: "border-amber-500 bg-amber-500 text-white" },
  { v: "cancelled", label: "Anulat", cls: "border-red-500 bg-red-500 text-white" },
  { v: "boarded", label: "Îmbarcat", cls: "border-[color:var(--navy-900)] bg-[color:var(--navy-900)] text-white" },
];

/** Starea afișată = îmbarcarea (dacă există) are prioritate peste răspunsul de contact. */
export function stateOf(b: { passengerResponse: string | null; boardedAt: string | null }): PassengerState {
  if (b.boardedAt) return "boarded";
  const r = b.passengerResponse;
  return r === "confirmed" || r === "no_answer" || r === "cancelled" ? r : "";
}

/**
 * Patch-ul de trimis la /api/operator/bookings/[id] pentru starea aleasă.
 * „Îmbarcat" scrie boardedAt/boardedBy; orice altă stare o retrage (dacă era pusă)
 * și setează răspunsul de contact în același request.
 */
export function statePatch(next: PassengerState, wasBoarded: boolean): Record<string, unknown> {
  if (next === "boarded") return { board: { boarded: true } };
  const patch: Record<string, unknown> = { passengerResponse: next || null };
  if (wasBoarded) patch.board = { boarded: false };
  return patch;
}

export function StatusSelect({
  value, onChange, readOnly, title,
}: {
  value: PassengerState;
  onChange?: (next: PassengerState) => Promise<unknown>;
  readOnly?: boolean;
  title?: string;
}) {
  const [busy, setBusy] = useState(false);
  const cur = PASSENGER_STATES.find((s) => s.v === value) ?? PASSENGER_STATES[0];
  const shell = `inline-flex items-center rounded-full border py-1 text-[11px] font-bold ${cur.cls}`;

  if (readOnly || !onChange) {
    return <span title={title} className={`${shell} px-2.5`}>{cur.label}</span>;
  }

  return (
    <span className={`relative ${shell}`} title={title}>
      <select
        value={value}
        disabled={busy}
        onChange={async (e) => {
          const next = e.target.value as PassengerState;
          if (next === value) return;
          setBusy(true);
          await onChange(next);
          setBusy(false);
        }}
        className="appearance-none cursor-pointer bg-transparent pl-2.5 pr-6 text-[11px] font-bold text-inherit outline-none disabled:opacity-60"
      >
        {PASSENGER_STATES.map((s) => (
          <option key={s.v} value={s.v} className="bg-white font-semibold text-[color:var(--navy-900)]">
            {s.label}
          </option>
        ))}
      </select>
      {busy
        ? <Loader2 className="pointer-events-none absolute right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 animate-spin" />
        : <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 opacity-80" />}
    </span>
  );
}
