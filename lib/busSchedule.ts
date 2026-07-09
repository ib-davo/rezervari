// REGULĂ RECURENTĂ a autobuzelor, per ȚARĂ (sursa: programul real, iul 2026).
// Nu materializează nimic — panoul o folosește pentru calendarul VIRTUAL pe tot
// anul; cursele reale se creează lazy doar când cineva rezervă.
//   JOI    → DAW 077  ·  Anglia + Luxemburg + Belgia  (fără Liège)
//   VINERI → ZNQ 874  ·  Belgia + Olanda + Germania   (tur-retur)
//   EXCEPȚIE 10 + 12 iul 2026 (vinerea + duminica aia) → DAW 777, TOT într-o
//   singură cursă (toate țările pe același autocar).

function isMD(c?: string | null): boolean {
  return /moldova/i.test(c ?? "");
}
function dk(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Datele-excepție când TOT merge cu DAW 777 (un singur autocar special).
const DAW777_DATES = new Set(["2026-07-10", "2026-07-12"]);
export function isDaw777Date(date: Date): boolean {
  return DAW777_DATES.has(dk(date));
}

// Autobuzul care deservește o țară (dus și retur — tur-retur pe același autocar).
export function busPlateForCountry(country: string): string | null {
  const c = (country || "").trim().toLowerCase();
  if (c === "anglia" || c === "luxemburg") return "DAW 077";
  if (c === "germania" || c === "belgia" || c === "olanda") return "ZNQ 874";
  return null;
}

// Autobuzul unei curse concrete, după DATĂ + țara non-Moldova. Excepția 10/12 iul
// suprascrie tot cu DAW 777, ca toate țările să cadă într-o singură cursă.
export function busPlateForRun(date: Date, originCountry?: string | null, destCountry?: string | null): string | null {
  if (isDaw777Date(date)) return "DAW 777";
  const nonMD = isMD(originCountry) ? destCountry : originCountry;
  return busPlateForCountry(nonMD ?? "");
}

export type CountrySchedule = {
  name: string;
  outboundWeekday: number | null;
  outboundTime: string | null;
  returnWeekday: number | null;
  returnTime: string | null;
};

export type VirtualRun = { plate: string; countries: string[]; inbound: boolean; time: string | null };

// Rulările programate pentru o zi dată (dus + retur), grupate pe autobuz, din
// regula recurentă + programul pe țări. Pur în memorie — nu atinge DB-ul. Pe
// datele-excepție, toate țările merg într-o singură cursă DAW 777 (per direcție).
export function scheduledRunsForDate(date: Date, countries: CountrySchedule[]): VirtualRun[] {
  const wd = date.getDay();
  const exception = isDaw777Date(date);
  const byKey = new Map<string, VirtualRun>();
  for (const c of countries) {
    if (isMD(c.name)) continue;
    const plate = exception ? "DAW 777" : busPlateForCountry(c.name);
    if (!plate) continue;
    if (c.outboundWeekday === wd) {
      const k = `out:${plate}`;
      let r = byKey.get(k);
      if (!r) { r = { plate, countries: [], inbound: false, time: c.outboundTime }; byKey.set(k, r); }
      r.countries.push(c.name);
      if (c.outboundTime && (!r.time || c.outboundTime < r.time)) r.time = c.outboundTime;
    }
    if (c.returnWeekday === wd) {
      const k = `in:${plate}`;
      let r = byKey.get(k);
      if (!r) { r = { plate, countries: [], inbound: true, time: c.returnTime }; byKey.set(k, r); }
      r.countries.push(c.name);
      if (c.returnTime && (!r.time || c.returnTime < r.time)) r.time = c.returnTime;
    }
  }
  return [...byKey.values()];
}
