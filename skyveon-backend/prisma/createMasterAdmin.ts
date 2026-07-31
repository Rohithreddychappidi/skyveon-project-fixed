/**
 * Bootstraps a MASTER_ADMIN account without touching any demo data (unlike
 * seed.ts, which also creates a demo admin/employee/course). Safe to run
 * against a real production database.
 *
 * Usage:
 *   npx ts-node prisma/createMasterAdmin.ts --email=you@yourdomain.com --name="Your Name"
 *
 * No password is set or printed here. Instead this reuses the exact same
 * sendSetupLink() flow used when a master admin adds a regular admin, or an
 * admin adds an employee: the new master admin gets a "set up your
 * password" email and chooses their own password by clicking the link.
 * That link expires after 48 hours (see auth.service.ts).
 */

import { prisma } from "../src/lib/prisma";
import { sendSetupLink } from "../src/modules/auth/auth.service";

function parseArgs() {
  const out: Record<string, string> = {};
  for (const arg of process.argv.slice(2)) {
    const match = /^--([^=]+)=(.*)$/.exec(arg);
    if (match) out[match[1]] = match[2];
  }
  return out;
}

async function main() {
  const { email, name } = parseArgs();

  if (!email || !name) {
    console.error(
      'Usage: npx ts-node prisma/createMasterAdmin.ts --email=you@yourdomain.com --name="Your Name"'
    );
    process.exitCode = 1;
    return;
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail.includes("@")) {
    console.error(`"${email}" doesn't look like a valid email address. Aborting.`);
    process.exitCode = 1;
    return;
  }

  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    console.error(
      `A user with email ${normalizedEmail} already exists (role: ${existing.role}, status: ${existing.status}). ` +
        `Nothing was created — use a different email, or handle that existing account directly if it needs fixing.`
    );
    process.exitCode = 1;
    return;
  }

  const masterAdmin = await prisma.user.create({
    data: {
      email: normalizedEmail,
      name: name.trim(),
      role: "MASTER_ADMIN",
      status: "ACTIVE",
      // passwordHash intentionally left null — set via the emailed link below.
    },
  });

  console.log(`✅ Master admin created: ${masterAdmin.email} (id: ${masterAdmin.id})`);

  await sendSetupLink(masterAdmin.id);

  console.log(
    `📧 Setup-password link sent to ${masterAdmin.email}. It expires in 48 hours — ` +
      `if it's not used in time, resend it from the app the same way you'd resend one for an admin or employee.`
  );
}

main()
  .catch((err) => {
    console.error("Failed to create master admin:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
