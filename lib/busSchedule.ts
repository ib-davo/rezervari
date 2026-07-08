// REGULĂ RECURENTĂ a autobuzelor, per ȚARĂ (sursa: programul real aliniat, iul
// 2026). Nu materializează nimic — panoul o folosește pentru calendarul VIRTUAL
// pe tot anul, iar cursele reale se creează lazy (ensureTripsForSchedule) doar
// când cineva chiar rezervă. Așa avem programul „ca o variabilă care se repetă",
// fără mii de rânduri separate.
//   Anglia + Luxemburg      → DAW 077  (dus joi / retur dum-lun)
//   Germania + Belgia + Olanda → ZNQ 874 (dus vineri / retur duminică)

function isMD(c?: string | null): boolean {
  return /moldova/i.test(c ?? "");
}

// Autobuzul care deservește o țară (dus și retur — tur-retur pe același autocar).
export function busPlateForCountry(country: string): string | null {
  const c = (country || "").trim().toLowerCase();
  if (c === "anglia" || c === "luxemburg") return "DAW 077";
  if (c === "germania" || c === "belgia" || c === "olanda") return "ZNQ 874";
  return null;
}

// Autobuzul unei curse (dus SAU retur) după țara non-Moldova.
export function busPlateForRun(originCountry?: string | null, destCountry?: string | null): string | null {
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
// regula recurentă + programul pe țări. Pur în memorie — nu atinge DB-ul.
export function scheduledRunsForDate(date: Date, countries: CountrySchedule[]): VirtualRun[] {
  const wd = date.getDay();
  const byKey = new Map<string, VirtualRun>();
  for (const c of countries) {
    if (isMD(c.name)) continue;
    const plate = busPlateForCountry(c.name);
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
