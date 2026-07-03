import { prisma } from "@/lib/prisma";

// Programul fiecărei țări (admin → "Țări") păstrează ora plecării ca string
// literal "HH:mm" în ora Moldovei (vezi schema Country.outboundTime). Vrem ca
// emailurile către client să afișeze EXACT ce a setat admin-ul — fără
// re-formatare din `booking.departureDate`, care altfel ar putea aluneca în
// UTC pe Vercel.

function extractCountry(city: string): string | null {
  const idx = city.lastIndexOf(",");
  if (idx < 0) return null;
  const tail = city.slice(idx + 1).trim();
  return tail.length > 0 ? tail : null;
}

export interface ScheduledTimes {
  departureTime?: string;
  returnTime?: string;
}

// Pentru un Booking dat, determină ora literală a plecării (și a întoarcerii
// dacă e round-trip), pe baza programului săptămânal al țării din DB.
// Returnează `undefined` pentru leg-uri care nu se mapează pe niciun program
// (ex: rezervare manuală Anglia → Belgia, sau țară fără program activ) —
// caller-ul va face fallback la `formatTime(booking.departureDate)`.
export async function resolveScheduledTimes(booking: {
  departureCity: string;
  arrivalCity: string;
  returnDate?: Date | string | null;
}): Promise<ScheduledTimes> {
  const depCountry = extractCountry(booking.departureCity);
  const arrCountry = extractCountry(booking.arrivalCity);
  const hasReturn = !!booking.returnDate;

  const result: ScheduledTimes = {};

  // Cazul 1: MD → țară străină → plecarea folosește outboundTime, retur folosește returnTime
  if (depCountry === "Moldova" && arrCountry && arrCountry !== "Moldova") {
    const c = await prisma.country.findUnique({ where: { name: arrCountry } });
    if (c?.outboundTime) result.departureTime = c.outboundTime;
    if (hasReturn && c?.returnTime) result.returnTime = c.returnTime;
    return result;
  }

  // Cazul 2: țară străină → MD → plecarea folosește returnTime, retur folosește outboundTime
  if (depCountry && depCountry !== "Moldova" && arrCountry === "Moldova") {
    const c = await prisma.country.findUnique({ where: { name: depCountry } });
    if (c?.returnTime) result.departureTime = c.returnTime;
    if (hasReturn && c?.outboundTime) result.returnTime = c.outboundTime;
    return result;
  }

  // Cazul 3: alte combinații (rezervări manuale farm-to-farm etc.) — fără override
  return result;
}
