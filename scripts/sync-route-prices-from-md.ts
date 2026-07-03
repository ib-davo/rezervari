/**
 * Aliniază prețul și moneda rutelor "Foreign → Moldova" cu cele de pe ruta
 * inversă "Moldova → Foreign". Sursa de adevăr e direcția DUS din MD: admin
 * a confirmat că acele prețuri sunt corecte azi.
 *
 * Pentru fiecare pereche:
 *   - Citește ruta MD → X (origin în Moldova)
 *   - Caută inversa X → MD
 *   - Dacă există + are alte valori → o setează cu basePrice + currency ale rutei dus
 *   - Dacă NU există → o creează (preluând toate atributele de la ruta dus)
 *
 * Usage:
 *   npx tsx scripts/sync-route-prices-from-md.ts         # dry-run
 *   npx tsx scripts/sync-route-prices-from-md.ts --apply # execută
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

async function main() {
  // Identificăm "Moldova" prin numele țării de pe orașul de origine.
  const outboundRoutes = await prisma.route.findMany({
    where: {
      originCity: { country: { name: "Moldova" } },
    },
    include: {
      originCity: { include: { country: true } },
      destinationCity: { include: { country: true } },
    },
    orderBy: [
      { destinationCity: { country: { name: "asc" } } },
      { destinationCity: { name: "asc" } },
    ],
  });

  console.log(`Rute MD → străinătate găsite: ${outboundRoutes.length}`);
  console.log(`Mod: ${APPLY ? "APPLY (scrie în DB)" : "DRY-RUN (doar listă)"}`);
  console.log("");

  let alreadyOK = 0;
  let updated = 0;
  let created = 0;
  let skipped = 0;

  for (const out of outboundRoutes) {
    const label = `${out.originCity.name} → ${out.destinationCity.name} (${out.destinationCity.country.name})`;
    const inverse = await prisma.route.findUnique({
      where: {
        originCityId_destinationCityId: {
          originCityId: out.destinationCityId,
          destinationCityId: out.originCityId,
        },
      },
    });

    if (inverse) {
      const drift =
        inverse.basePrice !== out.basePrice || inverse.currency !== out.currency;
      if (!drift) {
        alreadyOK++;
        continue;
      }
      const tag = APPLY ? "UPDATE" : "DRY-UPDATE";
      console.log(
        `${tag} ${label}`,
        `\n   dus  : ${out.basePrice} ${out.currency}`,
        `\n   retur: ${inverse.basePrice} ${inverse.currency} → ${out.basePrice} ${out.currency}`
      );
      if (APPLY) {
        await prisma.route.update({
          where: { id: inverse.id },
          data: { basePrice: out.basePrice, currency: out.currency },
        });
      }
      updated++;
    } else {
      // Inversa lipsește: o cream (DOAR în mod apply).
      const tag = APPLY ? "CREATE" : "DRY-CREATE";
      console.log(`${tag} inversă ${out.destinationCity.name} → ${out.originCity.name}`);
      console.log(`   preluăm: ${out.basePrice} ${out.currency}`);
      if (APPLY) {
        try {
          await prisma.route.create({
            data: {
              originCityId: out.destinationCityId,
              destinationCityId: out.originCityId,
              basePrice: out.basePrice,
              currency: out.currency,
              description: out.description,
              weeklyDepartures: out.weeklyDepartures,
              active: out.active,
            },
          });
          created++;
        } catch (e) {
          console.warn(`   ✗ nu am putut crea inversă: ${(e as Error).message}`);
          skipped++;
        }
      } else {
        created++; // count în dry-run ca să vedem proiecția
      }
    }
  }

  console.log("");
  console.log("=== Rezumat ===");
  console.log(`  Aliniate deja:        ${alreadyOK}`);
  console.log(`  Updated:              ${updated}`);
  console.log(`  Inverse create${APPLY ? "ate" : " în plan"}: ${created}`);
  if (skipped) console.log(`  Skipped (erori):      ${skipped}`);
  console.log(`  Total rute MD→...:    ${outboundRoutes.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
