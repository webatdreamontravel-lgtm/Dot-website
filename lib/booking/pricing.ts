/**
 * Booking price arithmetic.
 *
 * Shared by the booking form (to show a live breakdown) and the server
 * action (to snapshot onto the booking row), so the number the customer
 * agreed to and the number we store can never diverge.
 *
 * Everything is integer paise. Rupee floats would accumulate error across
 * GST and TCS and leave bookings a few paise off from their payments.
 */

export type BookingPriceInput = {
  pricePaise: number;
  gstPercent: number;
  tcsPercent: number;
  advancePaise: number | null;
};

export type PriceBreakdown = {
  seats: number;
  unitPricePaise: number;
  subtotalPaise: number;
  gstPercent: number;
  gstPaise: number;
  tcsPercent: number;
  tcsPaise: number;
  totalPaise: number;
  /** What the team will collect up front. Zero when the trip has no advance. */
  advanceDuePaise: number;
  /** Settled after the advance. */
  balancePaise: number;
};

export const MAX_SEATS_PER_BOOKING = 10;

/**
 * Round to a whole rupee.
 *
 * Prices are displayed with no paise (formatINR uses maximumFractionDigits:
 * 0), so leaving fractions in the stored amount means the customer is quoted
 * one number and charged another. 5% of ₹1,59,998 is ₹7,999.90, which shows
 * as ₹8,000 — a ten-paise discrepancy on every booking, waiting to be
 * reconciled by hand. Round here instead, once, and the two always agree.
 */
const toWholeRupees = (paise: number) => Math.round(paise / 100) * 100;

export function computePricing(trip: BookingPriceInput, seats: number): PriceBreakdown {
  const n = Math.max(1, Math.trunc(seats));
  const subtotalPaise = trip.pricePaise * n;

  // Tax is computed on the whole taxable value, not per head and multiplied.
  // Both are defensible; this one matches how the amount would appear on an
  // invoice, and rounds once instead of once per traveller.
  const gstPaise = toWholeRupees((subtotalPaise * trip.gstPercent) / 100);
  const tcsPaise = toWholeRupees((subtotalPaise * trip.tcsPercent) / 100);
  const totalPaise = subtotalPaise + gstPaise + tcsPaise;

  // The advance is quoted per person, so it scales with the party size.
  const advanceDuePaise = Math.min((trip.advancePaise ?? 0) * n, totalPaise);

  return {
    seats: n,
    unitPricePaise: trip.pricePaise,
    subtotalPaise,
    gstPercent: trip.gstPercent,
    gstPaise,
    tcsPercent: trip.tcsPercent,
    tcsPaise,
    totalPaise,
    advanceDuePaise,
    balancePaise: totalPaise - advanceDuePaise,
  };
}

/** Paise → rupees, for handing to formatINR. */
export const toRupees = (paise: number) => paise / 100;

/**
 * Re-prices an existing booking for a new seat count.
 *
 * Works from the booking's own snapshot, not the trip: if a traveller drops
 * out months later the remaining people must still pay the price they were
 * quoted, even if the trip has been repriced since. Only the quantity moves.
 */
export function recalcForSeats(
  booking: {
    unitPricePaise: number;
    gstPercent: number;
    tcsPercent: number;
  },
  seats: number,
) {
  const n = Math.max(0, Math.trunc(seats));
  const subtotalPaise = booking.unitPricePaise * n;
  const gstPaise = toWholeRupees((subtotalPaise * booking.gstPercent) / 100);
  const tcsPaise = toWholeRupees((subtotalPaise * booking.tcsPercent) / 100);

  return {
    seats: n,
    subtotalPaise,
    gstPaise,
    tcsPaise,
    totalPaise: subtotalPaise + gstPaise + tcsPaise,
  };
}

/**
 * Human-facing booking reference, e.g. DOT-TU26-0007.
 *
 * Quoted on WhatsApp and read aloud over the phone, so it avoids anything
 * ambiguous: uppercase letters from the trip, the departure year, and a
 * zero-padded sequence within that trip.
 */
export function buildReference(slug: string, startDate: Date, sequence: number) {
  const letters = slug.replace(/[^a-z]/gi, "").toUpperCase().slice(0, 2) || "DT";
  const year = String(startDate.getUTCFullYear()).slice(-2);
  return `DOT-${letters}${year}-${String(sequence).padStart(4, "0")}`;
}

// ─────────────────────────────────────────────────────────────
// Convenience fee
//
// The payment gateway's cut, passed to the customer — but only when they
// choose to pay online. Cash and bank transfers recorded by the team cost
// nothing to process and carry none.
//
// Deliberately NOT part of computePricing(). That function describes the
// trip: what it costs, what tax applies, what the advance is. The fee is a
// property of the payment rail, decided later and only sometimes. Folding it
// in would put it on trip pages and in booking totals, which is exactly where
// it must not appear — it is money in transit to Razorpay, not income.
// ─────────────────────────────────────────────────────────────

/** Basis points, so the rate is an integer. 236 = 2.36%. */
export type FeeRateBp = number;

export type ConvenienceFee = {
  /** What the booking is worth — unchanged by how it's paid. */
  bookingPaise: number;
  /** The fee itself, a whole number of rupees. */
  feePaise: number;
  /** What the customer is actually charged. bookingPaise + feePaise. */
  grossPaise: number;
  rateBp: FeeRateBp;
};

/**
 * Works out the fee on an amount about to be charged.
 *
 * Applied to the amount being paid NOW, not to the trip total — someone
 * paying an advance is only costing us the gateway's cut on the advance.
 * Paying in two instalments therefore attracts the fee twice, which is
 * correct: Razorpay charges us twice.
 *
 * Rounded to whole rupees with the same helper the tax lines use, so the
 * figure on the button is exactly the figure charged. A fee of ₹47.62 shown
 * as ₹48 but charged as ₹47.62 is a reconciliation problem forever.
 */
export function computeConvenienceFee(
  bookingPaise: number,
  rateBp: FeeRateBp,
): ConvenienceFee {
  const safeRate = Number.isFinite(rateBp) && rateBp > 0 ? Math.trunc(rateBp) : 0;
  const feePaise = safeRate === 0 ? 0 : toWholeRupees((bookingPaise * safeRate) / 10_000);

  return {
    bookingPaise,
    feePaise,
    grossPaise: bookingPaise + feePaise,
    rateBp: safeRate,
  };
}

/** "2.36%" — for the label beside the amount. */
export function formatFeeRate(rateBp: FeeRateBp): string {
  return `${(rateBp / 100).toFixed(2).replace(/\.?0+$/, "")}%`;
}
