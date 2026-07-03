// Seed operatori pentru panoul davo-operatori.
// PIN-urile NU mai sunt scrise aici (fișierul e urmărit de git) — vin din
// variabila de mediu OPERATOR_PINS, ținută în .env.local (gitignored) și în
// Vercel. Format: "slug:pin,slug:pin,..." (PIN = 4 cifre).
// Rulează: npm run seed:operators   (după ce ai setat OPERATOR_PINS)

import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

// Încarcă manual .env.local / .env (tsx nu le încarcă singur pentru scripturi).
// Set-if-absent: variabilele deja prezente în mediu (ex. din Vercel) au prioritate.
function loadEnvFile(file: string) {
  const p = path.join(process.cwd(), file);
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*?)\s*$/);
    if (!m || line.trimStart().startsWith("#")) continue;
    let val = m[2];
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(m[1] in process.env)) process.env[m[1]] = val;
  }
}
loadEnvFile(".env.local");
loadEnvFile(".env");

const prisma = new PrismaClient();

// Numele + slug-urile NU sunt secrete (endpoint-ul /api/operator/list le expune
// oricum). Doar PIN-ul e secret și vine din OPERATOR_PINS.
const OPERATORS: { name: string; slug: string; role?: string }[] = [
  { name: "Adrian", slug: "adrian" },
  { name: "Olga", slug: "olga" },
  { name: "Dumitru", slug: "dumitru" },
  { name: "Alexandru", slug: "alexandru" },
  { name: "Ghenadie", slug: "ghenadie" },
  { name: "Catalin", slug: "catalin" },
  { name: "Gabriela", slug: "gabriela" },
];

function parsePins(): Record<string, string> {
  const raw = process.env.OPERATOR_PINS;
  if (!raw) {
    throw new Error(
      "OPERATOR_PINS lipsește. Pune-l în .env.local (și în Vercel) în forma:\n" +
        '  OPERATOR_PINS="adrian:1234,olga:5678,..."'
    );
  }
  const map: Record<string, string> = {};
  for (const pair of raw.split(",")) {
    const [slug, pin] = pair.split(":").map((s) => s.trim());
    if (!slug || !/^\d{4}$/.test(pin || "")) {
      throw new Error(`Intrare OPERATOR_PINS invalidă: "${pair}" (aștept slug:1234)`);
    }
    map[slug] = pin;
  }
  return map;
}

async function main() {
  const pins = parsePins();
  for (const op of OPERATORS) {
    const pin = pins[op.slug];
    if (!pin) {
      console.warn(`⚠ Sar peste ${op.name} — nu are PIN în OPERATOR_PINS`);
      continue;
    }
    const pinHash = await bcrypt.hash(pin, 10);
    await prisma.operator.upsert({
      where: { slug: op.slug },
      update: { name: op.name, pinHash, role: op.role ?? "operator", active: true },
      create: { name: op.name, slug: op.slug, pinHash, role: op.role ?? "operator" },
    });
    console.log(`✓ ${op.name} (slug: ${op.slug})`);
  }
  console.log("\nGata. PIN-urile au fost actualizate din OPERATOR_PINS.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
