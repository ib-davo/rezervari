// Adaugă orașul Dortmund (Germania) în baza partajată davo: City + Route Chișinău→Dortmund.
// Idempotent (upsert). Rulează: npx tsx scripts/add-dortmund.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const germania = await prisma.country.findUnique({ where: { slug: "germania" } });
  if (!germania) throw new Error("Country 'germania' lipsește în DB");

  const city = await prisma.city.upsert({
    where: { slug: "dortmund" },
    update: { name: "Dortmund", countryId: germania.id, isOrigin: false },
    create: { name: "Dortmund", slug: "dortmund", isOrigin: false, countryId: germania.id },
  });

  const chisinau = await prisma.city.findUnique({ where: { slug: "chisinau" } });
  if (!chisinau) throw new Error("City 'chisinau' lipsește în DB");

  const route = await prisma.route.upsert({
    where: { originCityId_destinationCityId: { originCityId: chisinau.id, destinationCityId: city.id } },
    update: { basePrice: 120, currency: "EUR", active: true },
    create: {
      originCityId: chisinau.id,
      destinationCityId: city.id,
      basePrice: 120,
      currency: "EUR",
      active: true,
      weeklyDepartures: 2,
    },
  });

  console.log("✓ City Dortmund:", city.id);
  console.log("✓ Route Chișinău → Dortmund:", route.id, `${route.basePrice} ${route.currency}`, "active:", route.active);
  console.log("Germania are program:", germania.outboundWeekday !== null ? "da (curse se generează automat)" : "NU — setează program în admin");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
