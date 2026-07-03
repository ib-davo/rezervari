"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { computeSeatNumbers, type SeatKind, type SeatLayout } from "@/lib/adminMock";
import {
  Armchair,
  User,
  Bath,
  Minus,
  Coffee,
  MoveVertical,
  Square,
  Headset,
  DoorOpen,
  Hash,
} from "lucide-react";

// Ciclu pentru editorul vizual de layout: click pe celulă (fără unealtă activă)
// comută la următorul kind. Tipurile auxiliare (table/crew) nu intră în ciclul
// manual — se setează prin schițele predefinite — dar trebuie mapate la ceva.
const cycle: Record<SeatKind, SeatKind> = {
  seat: "aisle",
  aisle: "wc",
  wc: "driver",
  driver: "stairs",
  stairs: "cafe",
  cafe: "exit",
  exit: "empty",
  empty: "seat",
  crew: "seat",
  table: "seat",
};

// Unealta poate fi un tip de celulă (pictăm) sau modul "number" (editez numărul
// unui scaun). Separăm cele două ca să nu confundăm pictarea cu renumerotarea.
type Tool = SeatKind | "number";

const tools: { kind: Tool; label: string }[] = [
  { kind: "seat", label: "Scaun" },
  { kind: "aisle", label: "Culoar" },
  { kind: "wc", label: "Toaletă" },
  { kind: "driver", label: "Șofer" },
  { kind: "exit", label: "Ieșire" },
  { kind: "stairs", label: "Scări" },
  { kind: "cafe", label: "Cafea" },
  { kind: "empty", label: "Gol" },
  { kind: "number", label: "Nr. loc" },
];

function cellClasses(kind: SeatKind) {
  switch (kind) {
    case "seat":
      return "bg-orange-100 border-orange-300 text-orange-700 hover:bg-orange-200";
    case "aisle":
      return "bg-slate-100 border-dashed border-slate-300 text-slate-400";
    case "wc":
      return "bg-blue-100 border-blue-300 text-blue-700";
    case "driver":
      return "bg-slate-900 border-slate-900 text-white";
    case "crew":
      return "bg-slate-100 border-slate-400 text-slate-700";
    case "stairs":
      return "bg-amber-50 border-amber-300 text-amber-700";
    case "table":
      return "bg-slate-100 border-slate-300 text-slate-500";
    case "cafe":
      return "bg-orange-50 border-orange-300 text-orange-700";
    case "exit":
      return "bg-emerald-50 border-emerald-300 text-emerald-700";
    case "empty":
      return "bg-transparent border-dashed border-slate-200 text-slate-300";
  }
}

// Clasa vizuală pentru butonul din paletă. Modul "number" nu e un tip de celulă,
// deci îi dăm un stil propriu.
function toolSwatchClasses(kind: Tool) {
  if (kind === "number") return "bg-rose-50 border-rose-300 text-rose-600";
  return cellClasses(kind);
}

function CellIcon({ kind }: { kind: SeatKind }) {
  switch (kind) {
    case "seat":
      return <Armchair className="h-4 w-4" />;
    case "aisle":
      return <Minus className="h-3 w-3" />;
    case "wc":
      return <Bath className="h-4 w-4" />;
    case "driver":
      return <User className="h-4 w-4" />;
    case "crew":
      return <Headset className="h-4 w-4" />;
    case "stairs":
      return <MoveVertical className="h-4 w-4" />;
    case "table":
      return <Square className="h-4 w-4 opacity-60" />;
    case "cafe":
      return <Coffee className="h-4 w-4" />;
    case "exit":
      return <DoorOpen className="h-4 w-4" />;
    case "empty":
      return null;
  }
}

function ToolIcon({ kind }: { kind: Tool }) {
  if (kind === "number") return <Hash className="h-4 w-4" />;
  return <CellIcon kind={kind} />;
}

export default function SeatMapEditor({
  initial,
  onChange,
}: {
  initial: SeatLayout;
  onChange?: (next: SeatLayout) => void;
}) {
  const [layout, setLayout] = useState<SeatLayout>(initial);
  const [tool, setTool] = useState<Tool | null>(null);
  // Scaunul al cărui număr îl edităm acum (index în `cells`) + valoarea brută.
  const [editing, setEditing] = useState<{ idx: number; value: string } | null>(null);

  const seatCount = useMemo(
    () => layout.cells.filter((c) => c === "seat").length,
    [layout]
  );
  const numbers = useMemo(() => computeSeatNumbers(layout), [layout]);
  const overrides = layout.seatOverrides ?? {};

  // Detectăm numere duplicate (după renumerotare/override-uri) ca să avertizăm
  // adminul — două scaune cu același număr ar strica rezervările.
  const duplicates = useMemo(() => {
    const seen = new Map<number, number>();
    const dups = new Set<number>();
    numbers.forEach((n) => {
      if (n == null) return;
      const c = (seen.get(n) ?? 0) + 1;
      seen.set(n, c);
      if (c > 1) dups.add(n);
    });
    return dups;
  }, [numbers]);

  function patch(next: SeatLayout) {
    setLayout(next);
    onChange?.(next);
  }

  function setCell(i: number) {
    // Modul "Nr. loc": deschide editorul de număr pentru scaunul țintă.
    if (tool === "number") {
      if (layout.cells[i] !== "seat") return;
      setEditing({ idx: i, value: String(numbers[i] ?? "") });
      return;
    }

    const nextKind = (tool as SeatKind) ?? cycle[layout.cells[i]];
    const cells = layout.cells.slice();
    cells[i] = nextKind;

    // Dacă celula nu mai e scaun, override-ul ei nu mai are sens.
    let nextOverrides = overrides;
    if (nextKind !== "seat" && overrides[i] != null) {
      nextOverrides = { ...overrides };
      delete nextOverrides[i];
    }

    patch({ ...layout, cells, seatOverrides: pruneOverrides(nextOverrides) });
    if (editing?.idx === i) setEditing(null);
  }

  function commitNumber() {
    if (!editing) return;
    const raw = editing.value.trim();
    const next = { ...overrides };
    if (raw === "") {
      delete next[editing.idx];
    } else {
      const parsed = Number.parseInt(raw, 10);
      if (!Number.isFinite(parsed) || parsed < 1) {
        setEditing(null);
        return;
      }
      next[editing.idx] = parsed;
    }
    patch({ ...layout, seatOverrides: pruneOverrides(next) });
    setEditing(null);
  }

  function resize(delta: { rows?: number; cols?: number }) {
    const rows = Math.max(1, Math.min(30, layout.rows + (delta.rows ?? 0)));
    const cols = Math.max(1, Math.min(10, layout.cols + (delta.cols ?? 0)));
    const cells: SeatKind[] = [];
    const remapped: Record<number, number> = {};
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const oldIdx = r * layout.cols + c;
        const newIdx = r * cols + c;
        const keep = r < layout.rows && c < layout.cols;
        const kind: SeatKind = keep ? layout.cells[oldIdx] : "empty";
        cells.push(kind);
        // Mutăm override-ul împreună cu celula (poziția r,c se păstrează).
        if (keep && kind === "seat" && overrides[oldIdx] != null) {
          remapped[newIdx] = overrides[oldIdx];
        }
      }
    }
    patch({ ...layout, rows, cols, cells, seatOverrides: pruneOverrides(remapped) });
    setEditing(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Unealtă:
        </span>
        {tools.map((t) => (
          <button
            key={t.kind}
            type="button"
            onClick={() => setTool(t.kind === tool ? null : t.kind)}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition",
              tool === t.kind
                ? "border-orange-400 bg-orange-50 text-orange-700"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
            )}
          >
            <span className={cn("flex h-5 w-5 items-center justify-center rounded border", toolSwatchClasses(t.kind))}>
              <ToolIcon kind={t.kind} />
            </span>
            {t.label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2 text-xs text-slate-500">
          <span className="font-semibold text-slate-900">{seatCount}</span> scaune ·
          <span>{layout.rows}r × {layout.cols}c</span>
        </div>
      </div>

      {tool === "number" && (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          Mod „Nr. loc": click pe un scaun și scrie numărul dorit. Scaunul devine
          ancoră — numerotarea automată continuă de la acel număr înainte. Lasă
          gol pentru a reveni la numerotarea automată.
        </p>
      )}

      {duplicates.size > 0 && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Atenție: numere de loc duplicate ({[...duplicates].sort((a, b) => a - b).join(", ")}).
          Corectează-le înainte de salvare — altfel rezervările se vor suprapune.
        </p>
      )}

      <div className="rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white p-6 overflow-auto">
        <div className="mx-auto w-fit">
          <div className="mb-3 flex items-center justify-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            <span className="h-px w-8 bg-slate-200" /> Față autocar <span className="h-px w-8 bg-slate-200" />
          </div>
          <div
            className="grid gap-1.5"
            style={{ gridTemplateColumns: `repeat(${layout.cols}, minmax(0,1fr))` }}
          >
            {layout.cells.map((kind, i) => {
              const num = numbers[i];
              const isOverride = overrides[i] != null;
              const isDup = num != null && duplicates.has(num);
              if (editing?.idx === i) {
                return (
                  <div
                    key={i}
                    className="relative flex h-10 w-10 items-center justify-center rounded-md border border-rose-400 bg-white"
                  >
                    <input
                      autoFocus
                      type="number"
                      min={1}
                      value={editing.value}
                      onChange={(e) => setEditing({ idx: i, value: e.target.value })}
                      onBlur={commitNumber}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitNumber();
                        if (e.key === "Escape") setEditing(null);
                      }}
                      className="h-full w-full rounded-md text-center text-[11px] font-bold text-slate-900 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>
                );
              }
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => setCell(i)}
                  className={cn(
                    "relative flex h-10 w-10 items-center justify-center rounded-md border text-[10px] font-semibold transition",
                    cellClasses(kind),
                    tool === "number" && kind === "seat" && "ring-1 ring-rose-300",
                    isDup && "ring-2 ring-amber-400"
                  )}
                  title={`${kind}${num != null ? ` #${num}${isOverride ? " (manual)" : ""}` : ""}`}
                >
                  <CellIcon kind={kind} />
                  {num != null && (
                    <span
                      className={cn(
                        "absolute bottom-0.5 right-0.5 text-[9px] font-bold",
                        isOverride ? "text-rose-600" : "opacity-70"
                      )}
                    >
                      {num}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex items-center justify-center text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Spate autocar
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Dimensiuni:
        </span>
        <div className="flex items-center gap-1">
          <span className="text-xs text-slate-600">Rânduri</span>
          <button type="button" onClick={() => resize({ rows: -1 })} className="rounded border border-slate-200 px-2 py-0.5 text-xs hover:bg-slate-50">-</button>
          <span className="w-6 text-center text-xs font-semibold">{layout.rows}</span>
          <button type="button" onClick={() => resize({ rows: 1 })} className="rounded border border-slate-200 px-2 py-0.5 text-xs hover:bg-slate-50">+</button>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xs text-slate-600">Coloane</span>
          <button type="button" onClick={() => resize({ cols: -1 })} className="rounded border border-slate-200 px-2 py-0.5 text-xs hover:bg-slate-50">-</button>
          <span className="w-6 text-center text-xs font-semibold">{layout.cols}</span>
          <button type="button" onClick={() => resize({ cols: 1 })} className="rounded border border-slate-200 px-2 py-0.5 text-xs hover:bg-slate-50">+</button>
        </div>
      </div>
    </div>
  );
}

// Întoarce `undefined` dacă nu mai există override-uri, ca să nu serializăm un
// obiect gol în layoutJson.
function pruneOverrides(o: Record<number, number>): Record<number, number> | undefined {
  return Object.keys(o).length > 0 ? o : undefined;
}
