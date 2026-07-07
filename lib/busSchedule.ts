// Program FIX al autobuzelor (definit de operatori, iul 2026). Nu atinge baza
// de date — gruparea îl aplică peste cursele existente ca să apară autobuzul +
// orașele corecte pe fiecare zi de plecare.
//
// DUS (Moldova → Europa), după ziua săptămânii + țara destinației:
//   JOI    → DAW 077  ·  Anglia + Luxemburg + Belgia  (fără Liège)
//   VINERI → ZNQ 874  ·  Belgia + Olanda + Germania   (excepție: 10 iul 2026 → DAW 777)
// Retururile (Europa → Moldova) rămân deocamdată neschimbate.

function dk(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function isMD(c?: string | null): boolean {
  return /moldova/i.test(c ?? "");
}

export type ScheduledRun = { plate: string; countries: string[] };

// Ce autobuz + țări pleacă din Moldova într-o zi dată. null dacă nu e zi de plecare.
export function scheduleForDay(date: Date): ScheduledRun | null {
  const wd = date.getDay(); // 0=Dum .. 6=Sâm; Joi=4, Vineri=5
  if (wd === 4) return { plate: "DAW 077", countries: ["Anglia", "Luxemburg", "Belgia"] };
  if (wd === 5) {
    const plate = dk(date) === "2026-07-10" ? "DAW 777" : "ZNQ 874";
    return { plate, countries: ["Belgia", "Olanda", "Germania"] };
  }
  return null;
}

function matchCountry(name: string, list: string[]): boolean {
  const n = (name || "").trim().toLowerCase();
  return list.some((c) => c.toLowerCase() === n);
}

// Plăcuța autobuzului programat pentru o cursă concretă (dus SAU retur), sau null.
// DUS (din Moldova): după ziua săptămânii + țara destinației.
// RETUR (spre Moldova): tur-retur pe același autobuz → după țara de origine
//   (BE/OL/DE → ZNQ 874; Anglia/Lux → DAW 077); excepție retur 12 iul → DAW 777.
export function scheduledPlateForTrip(
  departureAt: Date,
  originCountry: string,
  destCountry: string,
  destCity: string,
): string | null {
  // DUS (pleacă din Moldova)
  if (isMD(originCountry)) {
    const sch = scheduleForDay(departureAt);
    if (!sch) return null;
    if (!matchCountry(destCountry, sch.countries)) return null;
    if (sch.plate === "DAW 077" && /li[eè]ge/i.test(destCity || "")) return null;
    return sch.plate;
  }
  // RETUR (vine spre Moldova) — tur-retur pe același autobuz ca dus-ul.
  if (isMD(destCountry)) {
    if (dk(departureAt) === "2026-07-12") return "DAW 777";
    if (matchCountry(originCountry, ["Belgia", "Olanda", "Germania"])) return "ZNQ 874";
    if (matchCountry(originCountry, ["Anglia", "Luxemburg"])) return "DAW 077";
  }
  return null;
}
