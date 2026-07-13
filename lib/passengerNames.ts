// Numele pasagerilor sunt stocate ca liste paralele unite cu ", "
// (firstName="Alnajm, Pidghirnaia", lastName="Joseph, Vitalina"). Concatenarea
// brută `firstName + " " + lastName` se citește greșit („Alnajm, Pidghirnaia
// Joseph, Vitalina" pare 3 pasageri) — le împerechem per pasager:
// „Alnajm Joseph, Pidghirnaia Vitalina".
export function displayPassengerNames(firstName: string, lastName: string): string {
  const firsts = (firstName || "").split(",").map((s) => s.trim()).filter(Boolean);
  const lasts = (lastName || "").split(",").map((s) => s.trim());
  const n = Math.max(firsts.length, lasts.filter(Boolean).length);
  if (n <= 1) return `${firstName} ${lastName}`.trim().replace(/\s+/g, " ");
  return Array.from({ length: n }, (_, i) => `${firsts[i] ?? ""} ${lasts[i] ?? ""}`.trim())
    .filter(Boolean)
    .join(", ");
}
