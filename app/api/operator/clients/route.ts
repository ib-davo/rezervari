import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyOperatorToken, OPERATOR_COOKIE } from "@/lib/operatorSession";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

// Telefon canonic — identic cu global_client_id (fără +373 / 0 / 00).
function canonicalPhone(raw: string) {
  let d = (raw || "").replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("373")) d = d.slice(3);
  d = d.replace(/^0+/, "");
  return d.length >= 6 ? d : "";
}

// Client read-only către DB-ul colete (Supabase separat). Doar server-side.
const coleteUrl = process.env.COLETE_SUPABASE_URL;
const coleteKey = process.env.COLETE_SUPABASE_SERVICE_KEY;
const colete = coleteUrl && coleteKey
  ? createClient(coleteUrl, coleteKey, { auth: { persistSession: false } })
  : null;

// Căutare clienți pentru autocomplete la rezervarea manuală. Caută în AMBELE baze:
// pasageri (Client, Prisma) + colete (clients, Supabase), unificate pe telefon canonic.
export async function GET(req: NextRequest) {
  const session = await verifyOperatorToken(req.cookies.get(OPERATOR_COOKIE)?.value);
  if (!session) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const q = (req.nextUrl.searchParams.get("q") || "").trim();
  if (q.length < 2) return NextResponse.json({ success: true, clients: [] });

  const nameTerm = q.replace(/[%,()*]/g, " ").trim(); // sanitizare pt ilike / PostgREST .or
  const digits = q.replace(/\D/g, "");

  // ---- Pasageri ----
  const pas = await prisma.client.findMany({
    where: {
      OR: [
        { firstName: { contains: nameTerm, mode: "insensitive" } },
        { lastName: { contains: nameTerm, mode: "insensitive" } },
        { phone: { contains: digits || nameTerm } },
        { email: { contains: nameTerm, mode: "insensitive" } },
      ],
    },
    select: { id: true, firstName: true, lastName: true, email: true, phone: true, vip: true },
    orderBy: { updatedAt: "desc" },
    take: 8,
  });
  const pasHits = pas.map((c) => ({ ...c, source: "pasager" as const }));
  const pasCanon = new Set(pasHits.map((h) => canonicalPhone(h.phone)).filter(Boolean));

  // ---- Colete ----
  // Adevărul despre "cine a apărut în colete" e în parcels (sender + receiver),
  // NU doar în tabelul clients (36% din colete n-au client_id, iar destinatarii
  // nu sunt niciodată clienți). Deci căutăm pe NUME în parcels (acoperă pe toți),
  // iar pe TELEFON în clients (are phone_digits normalizat).
  const people = new Map<string, { name: string; phone: string; canon: string }>();
  if (colete && nameTerm) {
    // 1. după nume în parcels (expeditori + destinatari)
    const { data: parcels } = await colete
      .from("parcels")
      .select("sender_details,receiver_details")
      .or(`sender_details->>name.ilike.%${nameTerm}%,receiver_details->>name.ilike.%${nameTerm}%`)
      .limit(40);
    const needle = nameTerm.toLowerCase();
    for (const p of (parcels || []) as Array<{ sender_details?: { name?: string; phone?: string }; receiver_details?: { name?: string; phone?: string } }>) {
      for (const side of [p.sender_details, p.receiver_details]) {
        const nm = (side?.name || "").trim();
        if (!nm || !nm.toLowerCase().includes(needle)) continue;
        const phone = (side?.phone || "").trim();
        const canon = canonicalPhone(phone);
        const key = canon || `name:${nm.toLowerCase()}`;
        if (!people.has(key)) people.set(key, { name: nm, phone, canon });
      }
    }
    // 2. după telefon: în clients (index normalizat) + în parcels (partea canonică
    //    apare de obicei contiguu, ex. "+373 60491425" conține "60491425").
    if (digits.length >= 4) {
      const canonQ = canonicalPhone(q) || digits;
      const { data: byPhone } = await colete
        .from("clients")
        .select("name,phone,phone_digits")
        .ilike("phone_digits", `%${digits}%`)
        .limit(10);
      for (const c of (byPhone || []) as Array<{ name?: string; phone?: string; phone_digits?: string }>) {
        const canon = canonicalPhone(c.phone_digits || c.phone || "");
        const key = canon || `name:${(c.name || "").toLowerCase()}`;
        if (!people.has(key)) people.set(key, { name: (c.name || "").trim(), phone: c.phone || "", canon });
      }
      const { data: pParcels } = await colete
        .from("parcels")
        .select("sender_details,receiver_details")
        .or(`sender_details->>phone.ilike.%${canonQ}%,receiver_details->>phone.ilike.%${canonQ}%`)
        .limit(20);
      for (const p of (pParcels || []) as Array<{ sender_details?: { name?: string; phone?: string }; receiver_details?: { name?: string; phone?: string } }>) {
        for (const side of [p.sender_details, p.receiver_details]) {
          const ph = (side?.phone || "").trim();
          if (!ph.replace(/\D/g, "").includes(canonQ)) continue;
          const canon = canonicalPhone(ph);
          const key = canon || `name:${(side?.name || "").toLowerCase()}`;
          if (!people.has(key)) people.set(key, { name: (side?.name || "").trim(), phone: ph, canon });
        }
      }
    }
  }
  const coleteHits = [...people.values()]
    .filter((pp) => !pp.canon || !pasCanon.has(pp.canon)) // nu dubla persoanele deja în pasageri
    .map((pp) => {
      const toks = pp.name.split(/\s+/).filter(Boolean);
      return {
        id: `colete:${pp.canon || pp.name}`,
        firstName: toks[0] || pp.name,
        lastName: toks.slice(1).join(" "),
        email: "",
        phone: pp.phone,
        vip: false,
        source: "colet" as const,
      };
    });

  const clients = [...pasHits, ...coleteHits].slice(0, 12);
  return NextResponse.json({ success: true, clients });
}
