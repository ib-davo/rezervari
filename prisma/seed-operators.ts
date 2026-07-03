// Seed operatori pentru panoul davo-operatori.
// PIN-uri 4 cifre (non-triviale). Schimbabile oricând — re-rulează scriptul după ce le modifici.
// Rulează: npx tsx prisma/seed-operators.ts

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// PLACEHOLDER PIN-uri — spune-le operatorilor și/sau schimbă-le aici, apoi re-rulează.
const OPERATORS: { name: string; slug: string; pin: string; role?: string }[] = [
  { name: "Adrian", slug: "adrian", pin: "1188" },
  { name: "Olga", slug: "olga", pin: "1919" },
  { name: "Dumitru", slug: "dumitru", pin: "6767" },
  { name: "Alexandru", slug: "alexandru", pin: "2323" },
  { name: "Ghenadie", slug: "ghenadie", pin: "8181" },
  { name: "Catalin", slug: "catalin", pin: "4646" },
  { name: "Gabriela", slug: "gabriela", pin: "7272" },
];

async function main() {
  for (const op of OPERATORS) {
    const pinHash = await bcrypt.hash(op.pin, 10);
    await prisma.operator.upsert({
      where: { slug: op.slug },
      update: { name: op.name, pinHash, role: op.role ?? "operator", active: true },
      create: { name: op.name, slug: op.slug, pinHash, role: op.role ?? "operator" },
    });
    console.log(`✓ ${op.name} (slug: ${op.slug}, PIN: ${op.pin})`);
  }
  console.log("\nGata. 7 operatori activi.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
