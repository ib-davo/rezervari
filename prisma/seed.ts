import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { destinations, moldovanCities } from "../lib/data";

const prisma = new PrismaClient();

const DEFAULT_ADMIN_EMAIL = "admin@davo.md";
const DEFAULT_ADMIN_PASSWORD = "admin123";

type SeatKind = "seat" | "aisle" | "wc" | "driver" | "empty";

function buildDefaultLayout(rows: number, cols: number) {
  const cells: SeatKind[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (r === 0 && c === 0) cells.push("driver");
      else if (c === Math.floor(cols / 2)) cells.push("aisle");
      else if (r === rows - 1 && c === cols - 1) cells.push("wc");
      else cells.push("seat");
    }
  }
  return { rows, cols, cells };
}

function countSeats(cells: SeatKind[]) {
  return cells.filter((c) => c === "seat").length;
}

async function main() {
  console.log("→ Seed: Moldova country + origin cities");
  const moldova = await prisma.country.upsert({
    where: { slug: "moldova" },
    update: {},
    create: { name: "Moldova", slug: "moldova", flag: "🇲🇩" },
  });

  for (const c of moldovanCities) {
    await prisma.city.upsert({
      where: { slug: c.slug },
      update: {},
      create: {
        name: c.name,
        slug: c.slug,
        isOrigin: true,
        countryId: moldova.id,
      },
    });
  }

  console.log("→ Seed: destination countries + cities + program săptămânal");
  const flagMap: Record<string, string> = {
    anglia: "🇬🇧",
    germania: "🇩🇪",
    belgia: "🇧🇪",
    olanda: "🇳🇱",
    luxemburg: "🇱🇺",
  };

  // Program fix dat de Adrian (operatorul):
  // - Anglia: dus joi 10:00 / retur duminică 19:00, ~36h cursă
  // - Belgia/Olanda/Germania: dus vineri 08:30 / retur duminică 12:00, ~28h cursă
  // - Luxemburg: încă neconfirmat → câmpurile rămân null (țară inactivă pt generare).
  // Weekday: 0=duminică, 4=joi, 5=vineri (JS Date.getDay()).
  type CountrySchedule = {
    outboundWeekday: number;
    outboundTime: string;
    outboundDurationHours: number;
    returnWeekday: number;
    returnTime: string;
    returnDurationHours: number;
  };
  const scheduleMap: Record<string, CountrySchedule> = {
    anglia: {
      outboundWeekday: 4,
      outboundTime: "10:00",
      outboundDurationHours: 36,
      returnWeekday: 0,
      returnTime: "19:00",
      returnDurationHours: 36,
    },
    belgia: {
      outboundWeekday: 5,
      outboundTime: "08:30",
      outboundDurationHours: 28,
      returnWeekday: 0,
      returnTime: "12:00",
      returnDurationHours: 28,
    },
    olanda: {
      outboundWeekday: 5,
      outboundTime: "08:30",
      outboundDurationHours: 28,
      returnWeekday: 0,
      returnTime: "12:00",
      returnDurationHours: 28,
    },
    germania: {
      outboundWeekday: 5,
      outboundTime: "08:30",
      outboundDurationHours: 28,
      returnWeekday: 0,
      returnTime: "12:00",
      returnDurationHours: 28,
    },
    luxemburg: {
      outboundWeekday: 4, // joi
      outboundTime: "10:00",
      outboundDurationHours: 28,
      returnWeekday: 1, // luni
      returnTime: "07:00",
      returnDurationHours: 28,
    },
  };

  for (const dest of destinations) {
    const sched = scheduleMap[dest.slug] ?? {
      outboundWeekday: null,
      outboundTime: null,
      outboundDurationHours: null,
      returnWeekday: null,
      returnTime: null,
      returnDurationHours: null,
    };
    const country = await prisma.country.upsert({
      where: { slug: dest.slug },
      update: {
        name: dest.name,
        flag: flagMap[dest.slug] ?? null,
        ...sched,
      },
      create: {
        name: dest.name,
        slug: dest.slug,
        flag: flagMap[dest.slug] ?? null,
        ...sched,
      },
    });
    for (const city of dest.cities) {
      await prisma.city.upsert({
        where: { slug: city.slug },
        update: {},
        create: {
          name: city.name,
          slug: city.slug,
          isOrigin: false,
          countryId: country.id,
        },
      });
    }
  }

  console.log("→ Seed: Routes (Chișinău → fiecare oraș destinație)");
  const chisinau = await prisma.city.findUnique({ where: { slug: "chisinau" } });
  if (!chisinau) throw new Error("Chișinău origin city missing");

  for (const dest of destinations) {
    const currency = dest.currency === "£" ? "GBP" : "EUR";
    const price = Number(dest.price) || 100;

    for (let i = 0; i < dest.cities.length; i++) {
      const cityRow = dest.cities[i];
      const destCity = await prisma.city.findUnique({ where: { slug: cityRow.slug } });
      if (!destCity) continue;

      const isPrimary = i === 0;

      await prisma.route.upsert({
        where: {
          originCityId_destinationCityId: {
            originCityId: chisinau.id,
            destinationCityId: destCity.id,
          },
        },
        // Pentru orașul primar păstrăm description/seoSlug (sunt despre țara în general).
        // Pentru celelalte orașe le lăsăm null — nu le suprascriem la fiecare seed.
        update: isPrimary
          ? {
              basePrice: price,
              currency,
              description: dest.description,
              seoSlug: dest.seoSlug,
              active: true,
            }
          : {
              basePrice: price,
              currency,
              active: true,
            },
        create: {
          originCityId: chisinau.id,
          destinationCityId: destCity.id,
          basePrice: price,
          currency,
          description: isPrimary ? dest.description : null,
          seoSlug: isPrimary ? dest.seoSlug : null,
          active: true,
          weeklyDepartures: 2,
        },
      });
    }
  }

  console.log("→ Seed: Autocare demo");
  const busesSeed = [
    { plate: "CJ 77 DAV", label: "Setra S 516 HD", model: "Setra ComfortClass", year: 2022, rows: 12, cols: 5 },
    { plate: "CJ 41 DAV", label: "MAN Lion's Coach", model: "MAN Lion's Coach RHC", year: 2021, rows: 13, cols: 5 },
    { plate: "MD 09 BUS", label: "Mercedes Tourismo", model: "Mercedes-Benz Tourismo RHD", year: 2020, rows: 12, cols: 5 },
  ];

  for (const b of busesSeed) {
    const layout = buildDefaultLayout(b.rows, b.cols);
    await prisma.bus.upsert({
      where: { plate: b.plate },
      update: {},
      create: {
        plate: b.plate,
        label: b.label,
        model: b.model,
        year: b.year,
        totalSeats: countSeats(layout.cells),
        layoutJson: JSON.stringify(layout),
        active: true,
      },
    });
  }

  console.log("→ Seed: Admin user (doar dacă nu există)");
  const existingAdmin = await prisma.adminUser.findUnique({
    where: { email: DEFAULT_ADMIN_EMAIL },
  });
  if (!existingAdmin) {
    const hash = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 10);
    await prisma.adminUser.create({
      data: {
        email: DEFAULT_ADMIN_EMAIL,
        name: "Administrator",
        password: hash,
        role: "admin",
      },
    });
    console.log(`   ✓ Admin creat: ${DEFAULT_ADMIN_EMAIL} / ${DEFAULT_ADMIN_PASSWORD}`);
    console.log("   ⚠ SCHIMBĂ parola după primul login!");
  } else {
    console.log(`   - Admin ${DEFAULT_ADMIN_EMAIL} există deja, nu suprascriu parola`);
  }

  const countries = await prisma.country.count();
  const cities = await prisma.city.count();
  const routes = await prisma.route.count();
  const buses = await prisma.bus.count();
  const admins = await prisma.adminUser.count();

  console.log("✔ Seed complet:");
  console.log(`   - ${countries} țări`);
  console.log(`   - ${cities} orașe`);
  console.log(`   - ${routes} rute`);
  console.log(`   - ${buses} autocare`);
  console.log(`   - ${admins} admini`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
