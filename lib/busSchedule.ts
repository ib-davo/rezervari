// REGULĂ RECURENTĂ a autobuzelor (sursa: programul real, iul 2026). Nu
// materializează nimic — panoul o folosește pentru calendarul VIRTUAL pe tot
// anul; cursele reale se creează lazy când cineva rezervă.
//   JOI    → DAW 077  ·  Anglia + Luxemburg + Belgia  (fără Liège)
//   VINERI → ZNQ 874  ·  Belgia + Olanda + Germania   (tur-retur)
//   Belgia are DOUĂ plecări/săpt: joi (DAW 077) ȘI vineri (ZNQ 874).
//   EXCEPȚIE 10 + 12 iul 2026 → DAW 777 pentru Belgia/Olanda/Germania (o cursă).
//   DAW 777 NU merge în Anglia/Luxemburg — acelea rămân pe DAW 077 și pe excepție.

function isMD(c?: string | null): boolean {
  return /moldova/i.test(c ?? "");
}
function dk(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const DAW777_DATES = new Set(["2026-07-10", "2026-07-12"]);
export function isDaw777Date(date: Date): boolean {
  return DAW777_DATES.has(dk(date));
}
// DAW 777 (Astromega) deservește DOAR Belgia/Olanda/Germania. Nu calcă niciodată
// în Anglia/Luxemburg — deci excepția nu se aplică acelor țări.
function daw777Serves(country?: string | null): boolean {
  const c = (country || "").trim().toLowerCase();
  return c === "belgia" || c === "olanda" || c === "germania";
}

// DUS: autobuzul e determinat de ZIUA săptămânii (joi DAW 077, vineri ZNQ 874).
// Așa Belgia merge cu DAW 077 joi și cu ZNQ 874 vineri, fără ambiguitate.
export function busPlateForOutboundWeekday(wd: number): string | null {
  if (wd === 4) return "DAW 077"; // joi
  if (wd === 5) return "ZNQ 874"; // vineri
  return null;
}

// RETUR: după țara de origine (tur-retur pe același autocar).
export function busPlateForReturn(country: string): string | null {
  const c = (country || "").trim().toLowerCase();
  if (c === "anglia" || c === "luxemburg") return "DAW 077";
  if (c === "belgia" || c === "olanda" || c === "germania") return "ZNQ 874";
  return null;
}

// Autobuzul „implicit" al unei țări (pentru fallback-uri simple, fără dată).
export function busPlateForCountry(country: string): string | null {
  const c = (country || "").trim().toLowerCase();
  if (c === "anglia" || c === "luxemburg") return "DAW 077";
  if (c === "germania" || c === "belgia" || c === "olanda") return "ZNQ 874";
  return null;
}

// Zile SUPLIMENTARE de plecare (dus), peste programul Country. Belgia mai pleacă
// și joi cu DAW 077 (pe lângă vineri cu ZNQ 874).
export function extraOutboundDays(country: string): Array<{ weekday: number; time: string; durationHours: number; plate: string }> {
  const c = (country || "").trim().toLowerCase();
  if (c === "belgia") return [{ weekday: 4, time: "07:00", durationHours: 28, plate: "DAW 077" }];
  return [];
}

// Autobuzul unei curse concrete, după DATĂ + țări. Excepția 10/12 iul → DAW 777.
export function busPlateForRun(date: Date, originCountry?: string | null, destCountry?: string | null): string | null {
  const euCountry = isMD(originCountry) ? destCountry : originCountry;
  if (isDaw777Date(date) && daw777Serves(euCountry)) return "DAW 777";
  if (isMD(originCountry)) return busPlateForOutboundWeekday(date.getDay()) ?? busPlateForCountry(destCountry ?? "");
  if (isMD(destCountry)) return busPlateForReturn(originCountry ?? "");
  return null;
}

export type CountrySchedule = {
  name: string;
  outboundWeekday: number | null;
  outboundTime: string | null;
  returnWeekday: number | null;
  returnTime: string | null;
};

export type VirtualRun = { plate: string; countries: string[]; inbound: boolean; time: string | null };

// Rulările programate pentru o zi (dus + retur), grupate pe autobuz. Belgia apare
// și joi (DAW 077) și vineri (ZNQ 874). Pe datele-excepție → o singură cursă DAW 777.
export function scheduledRunsForDate(date: Date, countries: CountrySchedule[]): VirtualRun[] {
  const wd = date.getDay();
  const exception = isDaw777Date(date);
  const byKey = new Map<string, VirtualRun>();
  const addRun = (dir: "out" | "in", plate: string, country: string, time: string | null) => {
    const k = `${dir}:${plate}`;
    let r = byKey.get(k);
    if (!r) { r = { plate, countries: [], inbound: dir === "in", time }; byKey.set(k, r); }
    if (!r.countries.includes(country)) r.countries.push(country);
    if (time && (!r.time || time < r.time)) r.time = time;
  };
  for (const c of countries) {
    if (isMD(c.name)) continue;
    if (c.outboundWeekday === wd) {
      const plate = (exception && daw777Serves(c.name)) ? "DAW 777" : (busPlateForOutboundWeekday(wd) ?? busPlateForCountry(c.name));
      if (plate) addRun("out", plate, c.name, c.outboundTime);
    }
    if (c.returnWeekday === wd) {
      const plate = (exception && daw777Serves(c.name)) ? "DAW 777" : busPlateForReturn(c.name);
      if (plate) addRun("in", plate, c.name, c.returnTime);
    }
    if (!exception) {
      for (const ex of extraOutboundDays(c.name)) {
        if (ex.weekday === wd) addRun("out", ex.plate, c.name, ex.time);
      }
    }
  }
  return [...byKey.values()];
}
