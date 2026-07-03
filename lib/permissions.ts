/**
 * Reguli de acces per rol pe paths-urile admin.
 *
 * Rolul "admin" e principal — acces total. "admin2" e operator restricționat:
 * doar Rezervări (citire + creare manuală) și Clienți (citire). Tot ce iese
 * din această listă (Curse, Țări, Rute, Autocare, Emailuri, Setări) e blocat
 * atât în UI (sidebar ascuns) cât și în backend (proxy → 403/redirect).
 */

export type Role = "admin" | "admin2";

// Paths de UI vizibile fiecărui rol (prefix-match, fără query string).
const UI_PATHS_BY_ROLE: Record<Role, string[]> = {
  admin: ["/admin"], // tot
  admin2: ["/admin/bookings", "/admin/clients", "/admin/seats"],
};

// API paths permise fiecărui rol (prefix-match).
const API_PATHS_BY_ROLE: Record<Role, string[]> = {
  admin: ["/api/admin"], // tot
  admin2: [
    "/api/admin/me",       // identitate proprie (toată lumea)
    "/api/admin/bookings",
    "/api/admin/clients",
    // Lookups pe care le folosesc paginile permise — fără ele formularele
    // de rezervare manuală nu funcționează:
    "/api/admin/routes", // GET pt. dropdown rute pe modalul de rezervare
    "/api/admin/buses",  // GET pt. layout autocar + locuri
    "/api/admin/trips",  // GET pt. lista curse → modal locuri
  ],
};

function matchesAny(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export function canAccessUI(role: Role, pathname: string): boolean {
  return matchesAny(pathname, UI_PATHS_BY_ROLE[role]);
}

export function canAccessAPI(role: Role, pathname: string): boolean {
  return matchesAny(pathname, API_PATHS_BY_ROLE[role]);
}

// Path-ul de "acasă" la care îl trimitem pe utilizator după login, în funcție
// de rolul lui. Util pentru redirecturi atunci când nu are voie pe `/admin`.
export function homePathForRole(role: Role): string {
  return role === "admin2" ? "/admin/bookings" : "/admin";
}

// Normalizează un string oarecare la un Role cunoscut. Default → "admin"
// (back-compat cu user-ii existenți care nu au coloana role).
export function normalizeRole(value: string | null | undefined): Role {
  return value === "admin2" ? "admin2" : "admin";
}
