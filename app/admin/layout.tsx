import type { Metadata } from "next";
import Link from "next/link";

import { requireAdmin } from "@/lib/auth";
import { signOut } from "@/app/login/actions";
import { AdminNav } from "./AdminNav";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · DOT Admin" },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Middleware only checks that *someone* is signed in — the role check
  // needs the database, so it happens here and again in every action.
  const admin = await requireAdmin();

  return (
    <div className="min-h-screen bg-[#f6f7f9] text-[#16203a] md:grid md:grid-cols-[232px_1fr] md:items-start">
      <aside className="flex flex-col gap-1 bg-[#0a162d] p-3 text-cream/70 md:sticky md:top-0 md:h-screen md:overflow-y-auto md:p-[22px_14px]">
        <Link href="/admin" className="mb-5 hidden items-center gap-2.5 px-2.5 pt-1 md:flex">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-yellow text-[0.62rem] font-bold text-navy">
            DOT
          </span>
          <span className="font-display text-lg font-semibold text-cream">Admin</span>
        </Link>

        <AdminNav />

        <div className="mt-auto hidden items-center gap-2.5 border-t border-cream/10 pt-3.5 text-[0.82rem] md:flex">
          <span className="grid h-7 w-7 flex-none place-items-center rounded-full bg-teal text-[0.68rem] font-semibold text-cream">
            {(admin.fullName ?? admin.email).slice(0, 1).toUpperCase()}
          </span>
          <span className="min-w-0 flex-1 truncate">{admin.fullName ?? admin.email}</span>
          <form action={signOut}>
            <button
              type="submit"
              className="text-[0.75rem] text-cream/50 underline underline-offset-2 hover:text-cream"
            >
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <main className="min-w-0 px-5 pb-16 pt-6 md:px-[30px]">{children}</main>
    </div>
  );
}
