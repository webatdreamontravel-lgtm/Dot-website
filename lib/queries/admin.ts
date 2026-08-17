import "server-only";

import { endOfDay, parseDateFilter } from "@/lib/dates";
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Admin read models.
 *
 * Every function here returns data a customer must never see, so each
 * caller must have gone through requireAdmin() first. Prisma bypasses RLS,
 * so there is no database-level safety net beneath these queries.
 */

export const rupees = (paise: number) => paise / 100;

export const PER_PAGE = 25;

/** One page of rows plus everything the pager needs to render itself. */
export type Paged<T> = {
  rows: T[];
  total: number;
  page: number;
  perPage: number;
  pageCount: number;
};

/**
 * Clamps a page number from the URL.
 *
 * `?page=0`, `?page=-3` and `?page=banana` all have to land somewhere, and
 * a page past the end should show the last page rather than an empty table
 * that looks like the filters matched nothing.
 */
export function resolvePage(raw: string | undefined, total: number, perPage = PER_PAGE) {
  const pageCount = Math.max(1, Math.ceil(total / perPage));
  const asked = Number.parseInt(raw ?? "1", 10);
  const page = Number.isFinite(asked) ? Math.min(Math.max(asked, 1), pageCount) : 1;
  return { page, pageCount, skip: (page - 1) * perPage };
}

export type DashboardStats = {
  collectedPaise: number;
  outstandingPaise: number;
  seatsSold: number;
  seatsTotal: number;
  liveTrips: number;
  failedPayments: number;
  bookingsToday: number;
  pendingRequests: number;
};

export async function getDashboardStats(): Promise<DashboardStats> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [captured, bookings, liveTrips, failed, today, requests] = await Promise.all([
    prisma.payment.aggregate({
      where: { status: "CAPTURED" },
      _sum: { amountPaise: true },
    }),
    // Outstanding is only meaningful for bookings that are actually live.
    prisma.booking.aggregate({
      where: { status: { in: ["CONFIRMED", "REQUESTED"] } },
      _sum: { totalPaise: true, amountPaidPaise: true },
    }),
    prisma.trip.findMany({
      where: { status: "PUBLISHED", deletedAt: null, endDate: { gte: new Date() } },
      select: { totalSeats: true, seatsBooked: true },
    }),
    prisma.payment.count({ where: { status: "FAILED" } }),
    prisma.booking.count({ where: { createdAt: { gte: startOfDay } } }),
    prisma.booking.count({ where: { status: "REQUESTED" } }),
  ]);

  return {
    collectedPaise: captured._sum.amountPaise ?? 0,
    outstandingPaise:
      (bookings._sum.totalPaise ?? 0) - (bookings._sum.amountPaidPaise ?? 0),
    seatsSold: liveTrips.reduce((n, t) => n + t.seatsBooked, 0),
    seatsTotal: liveTrips.reduce((n, t) => n + t.totalSeats, 0),
    liveTrips: liveTrips.length,
    failedPayments: failed,
    bookingsToday: today,
    pendingRequests: requests,
  };
}

export type TripFilters = {
  q?: string;
  status?: string;
  from?: string;
  to?: string;
  page?: string;
};

export type AdminTripRow = {
  id: string;
  slug: string;
  title: string;
  batchName: string | null;
  category: string | null;
  cardImage: string | null;
  startDate: Date;
  endDate: Date;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  totalSeats: number;
  seatsBooked: number;
  seatsAvailable: number;
  pricePaise: number;
  razorpayEnabled: boolean;
  bookingCount: number;
  departed: boolean;
};

function tripWhere({ q, status, from, to }: TripFilters): Prisma.TripWhereInput {
  const where: Prisma.TripWhereInput = { deletedAt: null };
  if (status) where.status = status as Prisma.TripWhereInput["status"];

  // Departure-date range. Both ends optional, so a single date works too.
  // Unparseable input is dropped rather than applied — a filter nobody can
  // see shouldn't be able to hide every row.
  const fromDate = parseDateFilter(from);
  const toDate = parseDateFilter(to);
  if (fromDate || toDate) {
    where.startDate = {
      ...(fromDate ? { gte: fromDate } : {}),
      ...(toDate ? { lte: toDate } : {}),
    };
  }

  // Search spans title AND batch name — the batch name exists precisely
  // because ten trips can share a title.
  if (q) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { batchName: { contains: q, mode: "insensitive" } },
      { destination: { contains: q, mode: "insensitive" } },
      { category: { contains: q, mode: "insensitive" } },
    ];
  }

  return where;
}

export async function getAdminTrips(
  filters: TripFilters = {},
  perPage = PER_PAGE,
): Promise<Paged<AdminTripRow>> {
  const where = tripWhere(filters);

  // Count first: the page number has to be clamped against a real total
  // before it can be turned into a skip.
  const total = await prisma.trip.count({ where });
  const { page, pageCount, skip } = resolvePage(filters.page, total, perPage);

  const trips = await prisma.trip.findMany({
    where,
    // startDate alone is not a total order — two trips departing the same
    // day could swap places between pages and one would never be shown.
    orderBy: [{ startDate: "asc" }, { id: "asc" }],
    skip,
    take: perPage,
    select: {
      id: true, slug: true, title: true, batchName: true, category: true, cardImage: true,
      startDate: true, endDate: true, status: true, totalSeats: true,
      seatsBooked: true, pricePaise: true, razorpayEnabled: true,
      _count: { select: { bookings: true } },
    },
  });

  // Seat availability is a plpgsql function, so it needs a raw query —
  // scoped to this page rather than the whole table.
  const ids = trips.map((t) => t.id);
  const avail = ids.length
    ? await prisma.$queryRaw<{ id: string; n: number }[]>`
        SELECT id, trip_seats_available(id) AS n
        FROM trips WHERE id IN (${Prisma.join(ids)})`
    : [];
  const availMap = new Map(avail.map((a) => [a.id, Number(a.n)]));
  const now = Date.now();

  return {
    rows: trips.map((t) => ({
      id: t.id,
      slug: t.slug,
      title: t.title,
      batchName: t.batchName,
      category: t.category,
      cardImage: t.cardImage,
      startDate: t.startDate,
      endDate: t.endDate,
      status: t.status,
      totalSeats: t.totalSeats,
      seatsBooked: t.seatsBooked,
      seatsAvailable: availMap.get(t.id) ?? 0,
      pricePaise: t.pricePaise,
      razorpayEnabled: t.razorpayEnabled,
      bookingCount: t._count.bookings,
      departed: t.endDate.getTime() < now,
    })),
    total,
    page,
    perPage,
    pageCount,
  };
}

/** Trips currently visible to customers — independent of the admin filters. */
export function countLiveTrips() {
  return prisma.trip.count({
    where: { status: "PUBLISHED", deletedAt: null, endDate: { gte: new Date() } },
  });
}

/** Live trips that haven't departed, soonest first — the dashboard list. */
export function getUpcomingTrips(limit = 8) {
  return prisma.trip.findMany({
    where: { status: "PUBLISHED", deletedAt: null, endDate: { gte: new Date() } },
    orderBy: [{ startDate: "asc" }, { id: "asc" }],
    take: limit,
    select: { id: true, title: true, startDate: true, seatsBooked: true, totalSeats: true },
  });
}

/** Published trips that have already ended — still showing as Live on the site. */
export function countDepartedTrips() {
  return prisma.trip.count({
    where: { status: "PUBLISHED", deletedAt: null, endDate: { lt: new Date() } },
  });
}

export async function getAdminTrip(id: string) {
  return prisma.trip.findFirst({
    where: { id, deletedAt: null },
    include: { pricingTiers: { orderBy: { sortOrder: "asc" } } },
  });
}

export type BookingFilters = {
  q?: string;
  tripId?: string;
  status?: string;
  payment?: string;
  source?: string;
  from?: string;
  to?: string;
  page?: string;
};

/** Money totals for a filtered set — computed over every match, not one page. */
export type BookingTotals = {
  count: number;
  /** Seats actually held — cancelled and expired bookings excluded. */
  seats: number;
  /** Seats given up: whole cancelled bookings, plus individually cancelled travellers. */
  cancelledSeats: number;
  totalPaise: number;
  /** Every rupee taken in, including on bookings later cancelled. */
  collectedPaise: number;
  /** Still owed — on live bookings only. Nobody owes money on a cancellation. */
  outstandingPaise: number;
  /** Taken from customers whose booking is now cancelled, and not yet returned. */
  toRefundPaise: number;
  /** Already returned. */
  refundedPaise: number;
};

/**
 * Payment state expressed in SQL rather than JavaScript.
 *
 * It used to be derived after the rows came back, which meant the filter only
 * ever saw the first page: asking for "unpaid" could return nothing while
 * unpaid bookings sat on page two. Field references let Postgres compare the
 * two money columns directly.
 */
function paymentCondition(payment?: string): Prisma.BookingWhereInput | null {
  const total = prisma.booking.fields.totalPaise;
  switch (payment) {
    case "UNPAID":
      return { amountPaidPaise: 0 };
    case "PAID":
      return { AND: [{ amountPaidPaise: { not: 0 } }, { amountPaidPaise: { gte: total } }] };
    case "PARTIAL":
      return { AND: [{ amountPaidPaise: { not: 0 } }, { amountPaidPaise: { lt: total } }] };
    default:
      return null;
  }
}

/**
 * Search spans the customer AND the booking reference, because the founders
 * will have either a WhatsApp name or a reference from an email.
 */
function bookingSearch(q: string): Prisma.BookingWhereInput[] {
  return [
    { reference: { contains: q, mode: "insensitive" } },
    { profile: { email: { contains: q, mode: "insensitive" } } },
    { profile: { fullName: { contains: q, mode: "insensitive" } } },
    { profile: { phone: { contains: q } } },
    { travellers: { some: { fullName: { contains: q, mode: "insensitive" } } } },
  ];
}

function bookingWhere(filters: BookingFilters, tripId?: string): Prisma.BookingWhereInput {
  const { q, status, source, from, to, payment } = filters;
  const and: Prisma.BookingWhereInput[] = [];

  const id = tripId ?? filters.tripId;
  if (id) and.push({ tripId: id });
  if (status) and.push({ status: status as Prisma.BookingWhereInput["status"] });
  if (source) and.push({ source: source as Prisma.BookingWhereInput["source"] });

  const fromDate = parseDateFilter(from);
  const toDate = parseDateFilter(to);
  if (fromDate || toDate) {
    and.push({
      createdAt: {
        ...(fromDate ? { gte: fromDate } : {}),
        // Inclusive of the whole end day, not midnight at its start.
        ...(toDate ? { lte: endOfDay(toDate) } : {}),
      },
    });
  }

  if (q) and.push({ OR: bookingSearch(q) });

  const pay = paymentCondition(payment);
  if (pay) and.push(pay);

  return and.length ? { AND: and } : {};
}

const DEAD_STATUSES = ["CANCELLED", "EXPIRED"] as const;

async function bookingTotals(where: Prisma.BookingWhereInput): Promise<BookingTotals> {
  const [agg, live, deadSeats, cancelledTravellers, dead] = await Promise.all([
    prisma.booking.aggregate({
      where,
      _count: { _all: true },
      _sum: { totalPaise: true, amountPaidPaise: true, refundedPaise: true },
    }),
    // Seats taken must mean seats actually held. Summing every booking
    // counted cancelled ones too, so the card read higher than the trip's own
    // "N of M booked" and implied capacity that was in fact free.
    prisma.booking.aggregate({
      where: { AND: [where, { status: { notIn: [...DEAD_STATUSES] } }] },
      _sum: { seats: true },
    }),
    prisma.booking.aggregate({
      where: { AND: [where, { status: { in: [...DEAD_STATUSES] } }] },
      _sum: { seats: true },
    }),
    // Seats given up one at a time, on bookings that are otherwise alive.
    // Counted separately from whole cancelled bookings so neither is
    // double-counted.
    prisma.bookingTraveller.count({
      where: {
        cancelledAt: { not: null },
        booking: { AND: [where, { status: { notIn: [...DEAD_STATUSES] } }] },
      },
    }),
    // Money sitting on bookings that are no longer going anywhere.
    prisma.booking.aggregate({
      where: { AND: [where, { status: { in: [...DEAD_STATUSES, "REFUNDED"] } }] },
      _sum: { amountPaidPaise: true, refundedPaise: true },
    }),
  ]);

  const totalPaise = agg._sum.totalPaise ?? 0;
  const collectedPaise = agg._sum.amountPaidPaise ?? 0;

  // Owed is a live-booking idea. Summing every booking counted the balance of
  // cancelled ones as debt, when in fact the money flows the other way.
  const liveTotals = await prisma.booking.aggregate({
    where: { AND: [where, { status: { notIn: [...DEAD_STATUSES, "REFUNDED"] } }] },
    _sum: { totalPaise: true, amountPaidPaise: true },
  });

  const refundedPaise = agg._sum.refundedPaise ?? 0;
  const deadCollected = dead._sum.amountPaidPaise ?? 0;
  const deadRefunded = dead._sum.refundedPaise ?? 0;

  return {
    count: agg._count._all,
    seats: live._sum.seats ?? 0,
    cancelledSeats: (deadSeats._sum.seats ?? 0) + cancelledTravellers,
    totalPaise,
    collectedPaise,
    outstandingPaise: Math.max(
      (liveTotals._sum.totalPaise ?? 0) - (liveTotals._sum.amountPaidPaise ?? 0),
      0,
    ),
    // Never negative: over-refunding is a data error, not a debt the
    // customer owes back.
    toRefundPaise: Math.max(deadCollected - deadRefunded, 0),
    refundedPaise,
  };
}

/** Payment state is derived rather than stored — a stored copy drifts the
 *  moment a refund or an offline payment lands. */
function withPaymentState<T extends { totalPaise: number; amountPaidPaise: number }>(b: T) {
  const balance = b.totalPaise - b.amountPaidPaise;
  return {
    ...b,
    balancePaise: balance,
    paymentState:
      b.amountPaidPaise === 0 ? "UNPAID" : balance <= 0 ? "PAID" : "PARTIAL",
  };
}

export async function getAdminBookings(filters: BookingFilters, perPage = PER_PAGE) {
  const where = bookingWhere(filters);
  const totals = await bookingTotals(where);
  const { page, pageCount, skip } = resolvePage(filters.page, totals.count, perPage);

  const rows = await prisma.booking.findMany({
    where,
    // createdAt ties are possible on a bulk import, so break them on id —
    // otherwise a row can appear on two pages or on none.
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip,
    take: perPage,
    select: {
      id: true, reference: true, status: true, source: true, seats: true,
      totalPaise: true, amountPaidPaise: true, createdAt: true,
      trip: { select: { title: true, slug: true } },
      profile: { select: { fullName: true, email: true, phone: true } },
      // Lead traveller doubles as the fallback name: profiles created by a
      // one-time-code sign-in carry nothing but an email.
      travellers: { select: { fullName: true, phone: true, email: true, cancelledAt: true } },
      _count: { select: { payments: true } },
    },
  });

  return {
    rows: rows.map(withPaymentState),
    total: totals.count,
    page,
    perPage,
    pageCount,
    totals,
  };
}

/** Bookings for one trip, with the same filter vocabulary as the main list. */
export async function getBookingsForTrip(
  tripId: string,
  filters: BookingFilters = {},
  perPage = PER_PAGE,
) {
  const where = bookingWhere(filters, tripId);
  const totals = await bookingTotals(where);
  const { page, pageCount, skip } = resolvePage(filters.page, totals.count, perPage);

  const rows = await prisma.booking.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip,
    take: perPage,
    select: {
      id: true, reference: true, status: true, source: true, seats: true,
      totalPaise: true, amountPaidPaise: true, createdAt: true,
      profile: { select: { fullName: true, email: true, phone: true } },
      travellers: { select: { fullName: true, phone: true, email: true, cancelledAt: true } },
    },
  });

  return {
    rows: rows.map(withPaymentState),
    total: totals.count,
    page,
    perPage,
    pageCount,
    totals,
  };
}

/** One booking, everything the management screen needs. */
export async function getAdminBooking(reference: string) {
  return prisma.booking.findUnique({
    where: { reference },
    select: {
      id: true, reference: true, status: true, source: true, seats: true,
      unitPricePaise: true, subtotalPaise: true,
      gstPercent: true, gstPaise: true, tcsPercent: true, tcsPaise: true,
      totalPaise: true, amountPaidPaise: true, refundedPaise: true,
      internalNotes: true, cancellationReason: true,
      createdAt: true, confirmedAt: true, cancelledAt: true,
      trip: {
        select: {
          id: true, slug: true, title: true, batchName: true,
          startDate: true, endDate: true, advancePaise: true,
        },
      },
      profile: { select: { id: true, fullName: true, email: true, phone: true, city: true } },
      travellers: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true, fullName: true, phone: true, email: true,
          cancelledAt: true,
          emergencyContactName: true, emergencyContactPhone: true,
        },
      },
      payments: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true, method: true, status: true, amountPaise: true,
          externalReference: true, notes: true, capturedAt: true, createdAt: true,
          recordedBy: { select: { fullName: true, email: true } },
        },
      },
    },
  });
}

export type CustomerFilters = {
  q?: string;
  city?: string;
  hasBookings?: string;
  page?: string;
};

export type AdminCustomerRow = {
  id: string;
  fullName: string | null;
  email: string;
  phone: string | null;
  city: string | null;
  state: string | null;
  gender: string | null;
  createdAt: Date;
  bookingCount: number;
  seats: number;
  totalPaise: number;
  paidPaise: number;
  emailVerified: boolean;
};

/**
 * The customer list.
 *
 * Verification status is joined in raw because it lives on auth.users, which
 * Prisma deliberately doesn't model — Supabase owns that table.
 */
export async function getAdminCustomers(
  filters: CustomerFilters = {},
  perPage = PER_PAGE,
): Promise<Paged<AdminCustomerRow>> {
  const { q, city, hasBookings } = filters;
  const and: Prisma.ProfileWhereInput[] = [{ role: "CUSTOMER" }];

  if (q) {
    and.push({
      OR: [
        { fullName: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { phone: { contains: q } },
      ],
    });
  }
  if (city) and.push({ city: { equals: city, mode: "insensitive" } });
  if (hasBookings === "yes") and.push({ bookings: { some: {} } });
  if (hasBookings === "no") and.push({ bookings: { none: {} } });

  const where: Prisma.ProfileWhereInput = { AND: and };

  const total = await prisma.profile.count({ where });
  const { page, pageCount, skip } = resolvePage(filters.page, total, perPage);

  const rows = await prisma.profile.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip,
    take: perPage,
    select: {
      id: true, fullName: true, email: true, phone: true,
      city: true, state: true, gender: true, createdAt: true,
      bookings: {
        select: { seats: true, totalPaise: true, amountPaidPaise: true, status: true },
      },
    },
  });

  const ids = rows.map((r) => r.id);
  const verified = ids.length
    ? await prisma.$queryRaw<{ id: string; ok: boolean }[]>`
        SELECT id, email_confirmed_at IS NOT NULL AS ok
        FROM auth.users WHERE id IN (${Prisma.join(ids)})`
    : [];
  const verifiedMap = new Map(verified.map((v) => [v.id, v.ok]));

  return {
    rows: rows.map((r) => {
      // Cancelled bookings still happened, but they aren't money owed or
      // seats taken — counting them would overstate every customer.
      const live = r.bookings.filter((b) => !["CANCELLED", "EXPIRED"].includes(b.status));
      return {
        id: r.id,
        fullName: r.fullName,
        email: r.email,
        phone: r.phone,
        city: r.city,
        state: r.state,
        gender: r.gender,
        createdAt: r.createdAt,
        bookingCount: r.bookings.length,
        seats: live.reduce((n, b) => n + b.seats, 0),
        totalPaise: live.reduce((n, b) => n + b.totalPaise, 0),
        paidPaise: live.reduce((n, b) => n + b.amountPaidPaise, 0),
        emailVerified: verifiedMap.get(r.id) ?? false,
      };
    }),
    total,
    page,
    perPage,
    pageCount,
  };
}

/**
 * Trips an admin can book someone onto, with live availability and the tax
 * rates the summary needs to price it.
 */
export async function getBookableTripsForAdmin() {
  const trips = await prisma.trip.findMany({
    where: { status: "PUBLISHED", deletedAt: null, endDate: { gte: new Date() } },
    orderBy: [{ startDate: "asc" }, { id: "asc" }],
    select: {
      id: true, title: true, batchName: true, startDate: true,
      pricePaise: true, gstPercent: true, tcsPercent: true, advancePaise: true,
    },
  });

  const ids = trips.map((t) => t.id);
  const avail = ids.length
    ? await prisma.$queryRaw<{ id: string; n: number }[]>`
        SELECT id, trip_seats_available(id) AS n FROM trips WHERE id IN (${Prisma.join(ids)})`
    : [];
  const availMap = new Map(avail.map((a) => [a.id, Number(a.n)]));

  return trips.map((t) => ({ ...t, seatsAvailable: availMap.get(t.id) ?? 0 }));
}

/** Typeahead for "who is this booking for?". */
export async function searchCustomers(q: string, take = 8) {
  const term = q.trim();
  if (term.length < 2) return [];

  return prisma.profile.findMany({
    where: {
      OR: [
        { fullName: { contains: term, mode: "insensitive" } },
        { email: { contains: term, mode: "insensitive" } },
        { phone: { contains: term } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true, fullName: true, email: true, phone: true, city: true,
      _count: { select: { bookings: true } },
    },
  });
}

/** Distinct cities, for the customer list filter. */
export async function getCustomerCities() {
  const rows = await prisma.profile.findMany({
    where: { role: "CUSTOMER", city: { not: null } },
    distinct: ["city"],
    orderBy: { city: "asc" },
    select: { city: true },
  });
  return rows.map((r) => r.city!).filter(Boolean);
}

/** One customer's profile, without their bookings. */
export async function getAdminCustomer(id: string) {
  const profile = await prisma.profile.findUnique({
    where: { id },
    select: {
      id: true, fullName: true, email: true, phone: true,
      city: true, state: true, gender: true, dateOfBirth: true,
      role: true, createdAt: true,
    },
  });

  if (!profile) return null;

  const [row] = await prisma.$queryRaw<{ ok: boolean }[]>`
    SELECT email_confirmed_at IS NOT NULL AS ok FROM auth.users WHERE id = ${id}::uuid`;

  return { ...profile, emailVerified: row?.ok ?? false };
}

export type CustomerStats = {
  bookings: number;
  cancelled: number;
  seats: number;
  totalPaise: number;
  paidPaise: number;
  outstandingPaise: number;
  averagePaise: number;
  tripsBooked: number;
  firstBookedAt: Date | null;
  lastBookedAt: Date | null;
  methods: { method: string; count: number; totalPaise: number }[];
};

/**
 * Everything the overview tab shows.
 *
 * Money counts only live bookings — a cancelled trip isn't revenue and isn't
 * owed. The booking count deliberately includes cancellations, because "how
 * often does this person cancel" is exactly what the team wants to see.
 */
export async function getCustomerStats(profileId: string): Promise<CustomerStats> {
  const LIVE: Prisma.EnumBookingStatusFilter = { notIn: ["CANCELLED", "EXPIRED"] };

  const [all, live, cancelled, trips, methods] = await Promise.all([
    prisma.booking.aggregate({
      where: { profileId },
      _count: { _all: true },
      _min: { createdAt: true },
      _max: { createdAt: true },
    }),
    prisma.booking.aggregate({
      where: { profileId, status: LIVE },
      _count: { _all: true },
      _sum: { seats: true, totalPaise: true, amountPaidPaise: true },
    }),
    prisma.booking.count({ where: { profileId, status: { in: ["CANCELLED", "EXPIRED"] } } }),
    prisma.booking.findMany({
      where: { profileId, status: LIVE },
      distinct: ["tripId"],
      select: { tripId: true },
    }),
    prisma.payment.groupBy({
      by: ["method"],
      where: { booking: { profileId }, status: "CAPTURED" },
      _count: { _all: true },
      _sum: { amountPaise: true },
    }),
  ]);

  const totalPaise = live._sum.totalPaise ?? 0;
  const paidPaise = live._sum.amountPaidPaise ?? 0;
  const liveCount = live._count._all;

  return {
    bookings: all._count._all,
    cancelled,
    seats: live._sum.seats ?? 0,
    totalPaise,
    paidPaise,
    outstandingPaise: totalPaise - paidPaise,
    averagePaise: liveCount > 0 ? Math.round(totalPaise / liveCount) : 0,
    tripsBooked: trips.length,
    firstBookedAt: all._min.createdAt,
    lastBookedAt: all._max.createdAt,
    methods: methods.map((m) => ({
      method: m.method,
      count: m._count._all,
      totalPaise: m._sum.amountPaise ?? 0,
    })),
  };
}

export type CustomerBookingFilters = {
  q?: string;
  status?: string;
  payment?: string;
  from?: string;
  to?: string;
  page?: string;
};

/** One customer's bookings, filtered and paged like every other admin table. */
export async function getCustomerBookings(
  profileId: string,
  filters: CustomerBookingFilters = {},
  perPage = PER_PAGE,
) {
  const and: Prisma.BookingWhereInput[] = [{ profileId }];

  if (filters.status) and.push({ status: filters.status as Prisma.BookingWhereInput["status"] });
  if (filters.q) {
    and.push({
      OR: [
        { reference: { contains: filters.q, mode: "insensitive" } },
        { trip: { title: { contains: filters.q, mode: "insensitive" } } },
        { trip: { batchName: { contains: filters.q, mode: "insensitive" } } },
      ],
    });
  }
  const fromDate = parseDateFilter(filters.from);
  const toDate = parseDateFilter(filters.to);
  if (fromDate || toDate) {
    and.push({
      createdAt: {
        ...(fromDate ? { gte: fromDate } : {}),
        ...(toDate ? { lte: endOfDay(toDate) } : {}),
      },
    });
  }
  const pay = paymentCondition(filters.payment);
  if (pay) and.push(pay);

  const where: Prisma.BookingWhereInput = { AND: and };

  const total = await prisma.booking.count({ where });
  const { page, pageCount, skip } = resolvePage(filters.page, total, perPage);

  const rows = await prisma.booking.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip,
    take: perPage,
    select: {
      id: true, reference: true, status: true, seats: true,
      totalPaise: true, amountPaidPaise: true, createdAt: true,
      trip: { select: { title: true, batchName: true, startDate: true, slug: true } },
    },
  });

  return { rows: rows.map(withPaymentState), total, page, perPage, pageCount };
}

export async function getTripOptions() {
  return prisma.trip.findMany({
    where: { deletedAt: null },
    orderBy: { startDate: "desc" },
    select: { id: true, title: true },
  });
}
