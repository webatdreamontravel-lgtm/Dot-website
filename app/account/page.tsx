import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Compass } from "lucide-react";

import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { requireUser } from "@/lib/auth";
import { toRupees } from "@/lib/booking/pricing";
import { getBookingsForCustomer } from "@/lib/queries/booking";
import { signOut } from "@/app/login/actions";
import { formatDateRange, formatINR } from "@/lib/utils";

export const metadata: Metadata = { title: "Your trips", robots: { index: false } };

const STATUS: Record<string, { label: string; className: string }> = {
  REQUESTED: { label: "Request received", className: "bg-yellow text-navy" },
  PENDING_PAYMENT: { label: "Awaiting payment", className: "bg-yellow text-navy" },
  CONFIRMED: { label: "Confirmed", className: "bg-teal text-cream" },
  CANCELLED: { label: "Cancelled", className: "bg-coral text-cream" },
  REFUNDED: { label: "Refunded", className: "bg-navy/10 text-navy" },
  EXPIRED: { label: "Expired", className: "bg-navy/10 text-navy" },
};

export default async function AccountPage() {
  const profile = await requireUser("/account");
  const { all, upcoming, past } = await getBookingsForCustomer(profile.id);

  return (
    <>
      <Navbar variant="solid" />
      <main className="min-h-screen bg-cream-soft pb-24 pt-28 md:pt-32">
        <div className="mx-auto max-w-3xl px-4 md:px-8">
          <header className="flex flex-wrap items-end gap-4">
            <div>
              <h1 className="font-display text-4xl tracking-tight text-navy md:text-5xl">
                Your trips
              </h1>
              <p className="mt-1.5 text-navy/60">
                {profile.fullName ? `${profile.fullName} · ` : ""}
                {profile.email}
              </p>
            </div>
            <form action={signOut} className="ml-auto">
              <button
                type="submit"
                className="text-sm text-navy/55 underline underline-offset-4 transition hover:text-navy"
              >
                Sign out
              </button>
            </form>
          </header>

          {all.length === 0 ? (
            <Empty />
          ) : (
            <>
              <Section title="Coming up" bookings={upcoming} emptyNote="Nothing booked yet." />
              {past.length > 0 && <Section title="Been there" bookings={past} />}
            </>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}

type Row = Awaited<ReturnType<typeof getBookingsForCustomer>>["all"][number];

function Section({
  title,
  bookings,
  emptyNote,
}: {
  title: string;
  bookings: Row[];
  emptyNote?: string;
}) {
  return (
    <section className="mt-10">
      <h2 className="mb-3 text-[0.75rem] font-semibold uppercase tracking-[0.11em] text-navy/45">
        {title}
      </h2>

      {bookings.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-navy/15 px-5 py-6 text-center text-[0.9rem] text-navy/50">
          {emptyNote}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {bookings.map((b) => {
            const status = STATUS[b.status] ?? { label: b.status, className: "bg-navy/10 text-navy" };
            return (
              <li key={b.id}>
                <Link
                  href={`/account/bookings/${b.reference}`}
                  className="group flex flex-wrap items-center gap-x-5 gap-y-3 rounded-2xl border border-navy/8 bg-cream px-5 py-4 transition hover:border-navy/20"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-[0.72rem] text-navy/40">{b.reference}</p>
                    <p className="font-display text-xl leading-tight text-navy">{b.trip.title}</p>
                    <p className="mt-0.5 text-[0.85rem] text-navy/55">
                      {b.trip.batchName && <span>{b.trip.batchName} · </span>}
                      {formatDateRange(
                        b.trip.startDate.toISOString(),
                        b.trip.endDate.toISOString(),
                      )}
                      {" · "}
                      {b.seats} {b.seats === 1 ? "seat" : "seats"}
                    </p>
                  </div>

                  <div className="text-right">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-[0.72rem] font-semibold ${status.className}`}
                    >
                      {status.label}
                    </span>
                    <p className="mt-1.5 font-display text-lg tabular-nums text-navy">
                      {formatINR(toRupees(b.totalPaise))}
                    </p>
                  </div>

                  <ArrowRight className="h-4 w-4 flex-none text-navy/25 transition group-hover:translate-x-0.5 group-hover:text-navy" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function Empty() {
  return (
    <div className="mt-10 rounded-3xl border border-navy/8 bg-cream px-8 py-12 text-center">
      <Compass className="mx-auto h-8 w-8 text-teal" />
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
