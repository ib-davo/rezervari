"use client";

import { useState } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import type { ActResult } from "@/lib/operatorAct";

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
 * „Îmbarcat" scrie boardedAt/boardedBy; o stare de contact o retrage (dacă era
 * pusă) și setează răspunsul de contact în același request.
 *
 * „Anulat" e anularea REALĂ — aceeași cu butonul „Anulează" din Acțiuni:
 * status=cancelled eliberează locurile, oprește reminderele și trimite emailul
 * de anulare; passengerResponse=cancelled păstrează și starea de contact, în
 * ACELAȘI request (ruta scrie ambele câmpuri pe ramura de status). Operatorul
 * anula din dropdown crezând că eliberează locul — dar era doar notița soft,
 * și trebuia apăsat ÎNCĂ o dată „Anulează" din Acțiuni ca locul să se întoarcă.
 * FĂRĂ `board` aici: ramura `board` din rută răspunde imediat și ar ignora
 * status-ul (ar retrage doar îmbarcarea, fără să elibereze nimic). Îmbarcarea
 * rămâne scrisă ca urmă istorică (cine l-a urcat); rândul anulat afișează
 * oricum „Anulat".
 */
export function statePatch(next: PassengerState, wasBoarded: boolean): Record<string, unknown> {
  if (next === "boarded") return { board: { boarded: true } };
  if (next === "cancelled") return { status: "cancelled", passengerResponse: "cancelled" };
  const patch: Record<string, unknown> = { passengerResponse: next || null };
  if (wasBoarded) patch.board = { boarded: false };
  return patch;
}

export function StatusSelect({
  value, onChange, hasEmail, readOnly, title,
}: {
  value: PassengerState;
  /** Întoarce rezultatul PATCH-ului — mesajul serverului se afișează lângă chip. */
  onChange?: (next: PassengerState) => Promise<ActResult>;
  /** Rezervarea are email de client → confirmarea de anulare anunță și emailul. */
  hasEmail?: boolean;
  readOnly?: boolean;
  title?: string;
}) {
  const [busy, setBusy] = useState(false);
  // „Anulat" ales din dropdown, în așteptarea confirmării. Anularea eliberează
  // locurile, trimite email de anulare și NU se poate întoarce complet (locurile
  // nu se realocă la re-confirmare) — o atingere greșită pe telefon n-are voie să
  // facă toate astea tăcut. Select-ul e controlat (value vine din părinte), deci
  // cât timp nu chemăm onChange el rămâne VIZUAL pe starea veche — „Nu" doar
  // închide chip-ul, fără nimic de derulat înapoi.
  const [confirmCancel, setConfirmCancel] = useState(false);
  // Serverul poate refuza („Cursa a plecat deja…") — mesajul lui, lângă rând.
  const [err, setErr] = useState<string | null>(null);
  const cur = PASSENGER_STATES.find((s) => s.v === value) ?? PASSENGER_STATES[0];
  const shell = `inline-flex items-center rounded-full border py-1 text-[11px] font-bold ${cur.cls}`;

  if (readOnly || !onChange) {
    return <span title={title} className={`${shell} px-2.5`}>{cur.label}</span>;
  }

  const run = async (next: PassengerState) => {
    setBusy(true);
    setErr(null);
    const r = await onChange(next);
    if (!r.ok) setErr(r.error || "Nu s-a putut salva — încearcă din nou.");
    setBusy(false);
    setConfirmCancel(false);
  };

  return (
    <>
      {confirmCancel ? (
        // Aceeași confirmare inline ca la „Anulează" din Acțiuni (chip roșu Da/Nu),
        // cu efectele spuse concret: locurile se eliberează, clientul e anunțat.
        <span className="inline-flex flex-wrap items-center gap-1.5 rounded-full bg-red-50 pl-3 pr-1 py-1 text-xs font-semibold text-red-700">
          {hasEmail ? "Eliberezi locurile + email de anulare — sigur?" : "Eliberezi locurile — sigur?"}
          <button
            disabled={busy}
            onClick={() => run("cancelled")}
            className="inline-flex items-center gap-1 rounded-full bg-red-600 px-2.5 py-1 text-xs font-semibold text-white active:scale-95 transition-transform disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : null} Da
          </button>
          <button
            disabled={busy}
            onClick={() => setConfirmCancel(false)}
            className="rounded-full px-2 py-1 text-xs font-semibold text-[color:var(--ink-500)] hover:bg-white"
          >
            Nu
          </button>
        </span>
      ) : (
        <span className={`relative ${shell}`} title={title}>
          <select
            value={value}
            disabled={busy}
            onChange={(e) => {
              const next = e.target.value as PassengerState;
              if (next === value) return;
              // Anularea reală cere confirmare; restul stărilor sunt soft și merg direct.
              if (next === "cancelled") {
                setErr(null);
                setConfirmCancel(true);
                return;
              }
              run(next);
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
      )}
      {err && <span className="text-[10px] font-semibold text-red-600">{err}</span>}
    </>
  );
}
