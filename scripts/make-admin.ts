/**
 * Grants — or revokes — ADMIN for an email address.
 *
 *   npm run make-admin -- you@example.com
 *   npm run make-admin -- you@example.com somepassword
 *   npm run make-admin -- you@example.com --revoke
 *
 * There is deliberately no way to self-promote through the app. Admin is
 * granted here, with database access, on purpose — otherwise a privilege
 * escalation bug in the UI would be a total compromise. Revoking lives here
 * for the same reason, and because demoting the last admin would lock
 * everyone out of the panel — so that case is refused.
 *
 * Creates the auth user if they haven't signed in yet, so you can grant
 * access before the person's first login.
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { createClient } from "@supabase/supabase-js";

import { PrismaClient } from "../lib/generated/prisma/client.js";

async function main() {
  const args = process.argv.slice(2).map((a) => a.trim()).filter(Boolean);
  const revoke = args.includes("--revoke");
  const rest = args.filter((a) => !a.startsWith("--"));
  const email = rest[0]?.toLowerCase();
  const password = rest[1];

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error("\nUsage: npm run make-admin -- you@example.com [password] [--revoke]\n");
    process.exit(1);
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  let profile = await prisma.profile.findUnique({ where: { email } });

  if (revoke) {
    if (!profile) {
      console.error(`\nNo profile for ${email} — nothing to revoke.\n`);
      await prisma.$disconnect();
      process.exit(1);
    }

    if (profile.role !== "ADMIN") {
      console.log(`\n  ${email} is already ${profile.role}. Nothing to do.\n`);
      await prisma.$disconnect();
      return;
    }

    // Refuse to demote the last admin: nobody could reach the panel to undo
    // it, and there is no self-promote path in the app by design.
    const admins = await prisma.profile.count({ where: { role: "ADMIN" } });
    if (admins <= 1) {
      console.error(
        `\n  ✋ ${email} is the only admin. Promote someone else first, or the panel becomes unreachable.\n`,
      );
      await prisma.$disconnect();
      process.exit(1);
    }

    const demoted = await prisma.profile.update({
      where: { id: profile.id },
      data: { role: "CUSTOMER" },
      select: { email: true, role: true },
    });

    console.log(`\n  ✅ ${demoted.email} is now ${demoted.role}`);
    console.log(`  Their sign-in still works; /admin will now redirect them away.`);
    console.log(`  ${admins - 1} admin(s) remaining.\n`);

    await prisma.$disconnect();
    return;
  }

  if (!profile) {
    // No profile means they've never signed in. Create the auth user so the
    // grant can happen ahead of their first login; the database trigger
    // provisions the matching profile row.
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (error && !/already/i.test(error.message)) {
      console.error(`\nCouldn't create the auth user: ${error.message}\n`);
      await prisma.$disconnect();
      process.exit(1);
    }

    if (data?.user) {
      console.log(`  created auth user for ${email}`);
      // The trigger fires on insert, but give it a moment on a cold pooler.
      await new Promise((r) => setTimeout(r, 400));
    }

    profile = await prisma.profile.findUnique({ where: { email } });
  }

  if (!profile) {
    console.error(`\nNo profile for ${email}. Sign in once at /login, then re-run this.\n`);
    await prisma.$disconnect();
    process.exit(1);
  }

  // Setting a password on an existing user, so a re-run can rotate it.
  if (password) {
    const { error } = await supabase.auth.admin.updateUserById(profile.id, {
      password,
      email_confirm: true,
    });
    if (error) {
      console.error(`\n  Couldn't set the password: ${error.message}\n`);
    } else {
      console.log(`  password set — sign in with email + password`);
    }
  }

  const updated = await prisma.profile.update({
    where: { id: profile.id },
    data: { role: "ADMIN" },
    select: { email: true, role: true, fullName: true },
  });

  console.log(`\n  ✅ ${updated.email} is now ${updated.role}`);
  console.log(`  Sign in at /login and you'll land on /admin\n`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("\n💥", e);
  process.exit(1);
});
