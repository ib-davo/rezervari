// Cât timp rămâne o cursă (și pasagerii ei) în panoul „Active".
//
// O cursă Moldova↔EU stă 28–40h PE DRUM (vezi Trip.arrivalAt: Belgia/Olanda/
// Germania ~28–36h, Anglia ~40h). Pragul vechi — 24h de la PLECARE — ștergea
// lista fix când autocarul era încă în trafic: seara operatorul avea 21 de
// pasageri, dimineața 6. Ținem 3 zile de la ULTIMA etapă (returul dacă există,
// altfel plecarea): acoperă cel mai lung drum plus o zi de decontare după sosire.
//
// Un singur prag pentru TOATE locurile care împart rezervările în active/arhivă
// (panoul de curse, lista Active/Arhivă, cronul de arhivare). Înainte fiecare
// avea alt prag — panoul 24h, lista 0h, cronul 24h — deci o rezervare putea fi
// „activă" într-un loc și dispărută în altul.
export const ACTIVE_RETENTION_DAYS = 3;
export const ACTIVE_RETENTION_MS = ACTIVE_RETENTION_DAYS * 24 * 60 * 60 * 1000;

export function activeCutoff(now: Date = new Date()): Date {
  return new Date(now.getTime() - ACTIVE_RETENTION_MS);
}

// Rezervări încă „în desfășurare" la momentul `cutoff` — contează ultima etapă.
export function activeLegWhere(cutoff: Date) {
  return [
    { returnDate: { gte: cutoff } },
    { returnDate: null, departureDate: { gte: cutoff } },
  ];
}

// Complementul exact al lui activeLegWhere — o rezervare cade într-unul sau în
// celălalt, niciodată în ambele și niciodată în niciunul.
export function pastLegWhere(cutoff: Date) {
  return [
    { returnDate: null, departureDate: { lt: cutoff } },
    { returnDate: { not: null, lt: cutoff } },
  ];
}
