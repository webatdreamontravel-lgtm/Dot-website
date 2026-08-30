import type { Metadata } from "next";
import Link from "next/link";
import { Compass, Wallet } from "lucide-react";

import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { creditBalance } from "@/lib/credit/ledger";
import { requireUser } from "@/lib/auth";
import { siteConfig } from "@/lib/data/siteConfig";
import { toRupees } from "@/lib/booking/pricing";
import { getCustomerBookings, getCustomerSummary } from "@/lib/queries/booking";
import { signOut } from "@/app/login/actions";
import { formatINR } from "@/lib/utils";
import { AccountToolbar } from "./AccountToolbar";
import { BookingCard } from "./BookingCard";
import { AccountPagination } from "./AccountPagination";

export const metadata: Metadata = { title: "Your trips", robots: { index: false } };

type SP = Promise<{ q?: string; view?: string; page?: string }>;

export default async function AccountPage({ searchParams }: { searchParams: SP }) {
  const profile = await requireUser("/account");
  const filters = await searchParams;

  const [{ rows, total, page, pageCount }, summary, creditPaise] = await Promise.all([
    getCustomerBookings(profile.id, filters),
    getCustomerSummary(profile.id),
    creditBalance(profile.id),
  ]);

  const customer = {
    name: profile.fullName,
    email: profile.email,
    phone: profile.phone,
  };
  const filtered = Boolean(filters.q || filters.view);

  return (
    <>
      <Navbar variant="solid" />
      <main className="min-h-screen bg-cream-soft pb-24 pt-28 md:pt-32">
        {/* Wider than the old max-w-3xl: the cards carry a trip, dates, a
            payment breakdown and two actions, and squeezing that into a
            narrow column pushed everything into a stack on desktop while
            leaving half the screen empty. */}
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          {/* Above the bookings, not inside them.
              
              Credit belongs to the person, not to any one booking — and it
              exists precisely because a booking was cancelled, so putting it
              on a card would attach it to the trip they are no longer going
              on. Nobody would find it there. */}
          {creditPaise > 0 && (
            <div className="mb-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 rounded-2xl border border-teal/25 bg-teal/[0.07] px-5 py-4">
              <div>
                <p className="font-display text-2xl leading-none text-navy">
                  {formatINR(toRupees(creditPaise))} travel credit
                </p>
                <p className="mt-1.5 text-[0.85rem] leading-relaxed text-navy/65">
                  Held from a cancelled booking. It doesn&apos;t expire — tell us when you&apos;re
                  ready to book and we&apos;ll put it towards the cost.
                </p>
              </div>
              <a href={siteConfig.whatsappUrl} target="_blank" rel="noreferrer" className="btn btn-primary">
                Plan your next trip
              </a>
            </div>
          )}

          <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
            <div className="min-w-0">
              <h1 className="font-display text-4xl tracking-tight text-navy md:text-5xl">
                Your trips
              </h1>
              <p className="mt-1.5 truncate text-navy/60">
                {profile.fullName ? `${profile.fullName} · ` : ""}
                {profile.email}
              </p>
            </div>

            <div className="flex items-center gap-4">
              <Link href="/trips" className="btn btn-primary hidden sm:inline-flex">
                Book a trip
              </Link>
              <form action={signOut}>
                <button
                  type="submit"
                  className="min-h-[40px] px-1 text-sm text-navy/55 underline underline-offset-4 transition hover:text-navy"
                >
                  Sign out
                </button>
              </form>
            </div>
          </header>

          {/* The one number worth surfacing above everything else. Someone
              who owes money should not have to open a booking to find out. */}
          {summary.outstandingPaise > 0 && (
            <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-yellow/40 bg-yellow/[0.14] px-5 py-4">
              <Wallet className="h-5 w-5 flex-none text-navy/70" aria-hidden />
              <p className="text-[0.95rem] text-navy">
                <strong className="font-display text-xl">
                  {formatINR(toRupees(summary.outstandingPaise))}
                </strong>{" "}
                still to pay across {summary.upcomingCount}{" "}
                {summary.upcomingCount === 1 ? "trip" : "trips"}.
              </p>
              {!filters.view && (
                <Link
                  href="/account?view=owing"
                  className="ml-auto text-[0.88rem] font-medium text-navy underline underline-offset-4"
                >
                  Show what I owe
                </Link>
              )}
            </div>
          )}

          {total === 0 && !filtered ? (
            <Empty />
          ) : (
            <AccountToolbar total={total} showing={rows.length}>
              {rows.length === 0 ? (
                <NoMatches />
              ) : (
                <>
                  <ul className="mt-5 flex flex-col gap-3">
                    {rows.map((b) => (
                      <BookingCard key={b.id} booking={b} customer={customer} />
                    ))}
                  </ul>
                  <AccountPagination page={page} pageCount={pageCount} total={total} />
                </>
              )}
            </AccountToolbar>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}

function Empty() {
  return (
    <div className="mt-10 rounded-3xl border border-navy/8 bg-cream px-6 py-14 text-center sm:px-8">
      <Compass className="mx-auto h-8 w-8 text-teal" aria-hidden />
      <p className="mt-4 font-display text-2xl text-navy">No trips yet.</p>
      <p className="mx-auto mt-2 max-w-sm text-navy/60">
        When you book a trip it&apos;ll live here — travellers, what you owe, and the
        booking reference to quote us.
      </p>
      <Link href="/trips" className="btn btn-primary mt-6 inline-flex">
        See what&apos;s coming up
      </Link>
    </div>
  );
}

function NoMatches() {
  return (
    <p className="mt-5 rounded-2xl border border-dashed border-navy/15 px-5 py-10 text-center text-[0.92rem] text-navy/55">
      No bookings match that. Try a different search, or clear the filter.
    </p>
  );
}
