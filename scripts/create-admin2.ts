/**
 * Creează (sau actualizează) un cont admin restricționat ("admin2"). Acces
 * doar la Rezervări și Clienți. Vezi lib/permissions.ts.
 *
 * Usage:
 *   npx tsx scripts/create-admin2.ts                                  # default email/parolă
 *   npx tsx scripts/create-admin2.ts admin2@davo.md 12345678x
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const DEFAULT_EMAIL = "admin2@davo.md";
const DEFAULT_PASSWORD = "12345678x";

async function main() {
  const email = (process.argv[2] || DEFAULT_EMAIL).toLowerCase();
  const password = process.argv[3] || DEFAULT_PASSWORD;

  const prisma = new PrismaClient();
  const hash = await bcrypt.hash(password, 12);

  const user = await prisma.adminUser.upsert({
    where: { email },
    update: {
      password: hash,
      role: "admin2",
    },
    create: {
      email,
      name: "Admin 2",
      password: hash,
      role: "admin2",
    },
  });

  console.log("✓ AdminUser configurat:");
  console.log("  id   :", user.id);
  console.log("  email:", user.email);
  console.log("  role :", user.role);
  console.log("  pass :", password, "(stocată cu bcrypt în DB)");

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
