/**
 * Catalogul secțiunilor din panoul operatorilor și presetele pe rol.
 *
 * Permisiunile sunt chei de secțiuni salvate pe fiecare cont
 * (`Operator.permissions`), nu path-uri hardcodate pe rol. Rolul rămâne doar
 * preset: lista goală înseamnă „folosește presetul rolului" — de asta
 * operatorii existenți, care au toți `permissions = []`, văd exact ce vedeau
 * și înainte.
 *
 * Fișierul e importat și din layout-ul panoului, care e componentă client,
 * deci n-are voie să atingă Prisma, env sau alt cod de server.
 *
 * Geamănul lui e `lib/rezervariSections.ts` din repo-ul davo, de unde adminul
 * bifează permisiunile. Cele două repo-uri nu pot face import unul din altul
 * (deploy-uri separate, doar baza e comună), deci cheile TREBUIE ținute
 * identice manual — altfel se salvează chei pe care panoul de aici nu le
 * recunoaște.
 */

export type OperatorRole = "operator" | "supervisor";

export type OperatorSection = {
  key: string; // "arhiva"
  label: string; // "Arhivă"
  group: string; // gruparea din selectorul de permisiuni
  ui: string[]; // prefixe de path din panou acoperite de secțiune
};

/** Ordinea contează: e ordinea taburilor din panou și a bifelor din selector. */
export const OPERATOR_SECTIONS: OperatorSection[] = [
  { key: "active", label: "Rezervări active", group: "Panou operatori", ui: ["/panou"] },
  { key: "rezervare", label: "Rezervare nouă", group: "Panou operatori", ui: ["/panou/rezervare"] },
  { key: "arhiva", label: "Arhivă", group: "Panou operatori", ui: ["/panou/arhiva"] },
  { key: "operatori", label: "Gestiune operatori", group: "Panou operatori", ui: ["/panou/operatori"] },
];

export const OPERATOR_SECTION_KEYS: string[] = OPERATOR_SECTIONS.map((s) => s.key);

export const OPERATOR_ROLE_PRESETS: Record<OperatorRole, string[]> = {
  // Identic cu ce vede azi un operator obișnuit: active, rezervare nouă, arhivă.
  operator: ["active", "rezervare", "arhiva"],
  // Supervizorul primește tot, inclusiv gestiunea operatorilor.
  supervisor: OPERATOR_SECTIONS.map((s) => s.key),
};

/** Default „operator": rolul cu cele mai puține drepturi, când valoarea e necunoscută. */
export function normalizeOperatorRole(value: string | null | undefined): OperatorRole {
  return value === "supervisor" ? "supervisor" : "operator";
}

export function isOperatorSectionKey(key: string): boolean {
  return OPERATOR_SECTIONS.some((s) => s.key === key);
}

/** Lista efectivă de chei: cea a operatorului dacă e ne-goală, altfel presetul rolului. */
export function effectiveOperatorPermissions(
  role: OperatorRole,
  permissions?: string[] | null,
): string[] {
  if (permissions && permissions.length > 0) return permissions;
  return OPERATOR_ROLE_PRESETS[role];
}

/**
 * Validează ce vine dintr-un body de API.
 *
 * `undefined`/`null` înseamnă „câmpul n-a fost trimis" → permisiunile nu se
 * ating (clientul vechi, care trimite doar nume/PIN/rol, rămâne valid).
 * Lista goală e o valoare legitimă: „folosește presetul rolului".
 */
export function parseOperatorPermissions(
  value: unknown,
):
  | { ok: true; permissions: string[] | undefined }
  | { ok: false; error: string } {
  if (value === undefined || value === null) return { ok: true, permissions: undefined };
  if (!Array.isArray(value)) return { ok: false, error: "Permisiunile trebuie să fie o listă" };

  const keys: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") return { ok: false, error: "Permisiunile trebuie să fie o listă" };
    const key = item.trim();
    if (!isOperatorSectionKey(key)) {
      return { ok: false, error: `Permisiune necunoscută: „${key}"` };
    }
    if (!keys.includes(key)) keys.push(key);
  }

  return { ok: true, permissions: keys };
}
