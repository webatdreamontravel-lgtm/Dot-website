import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatINR(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDateRange(start: string, end: string) {
  const s = new Date(start);
  const e = new Date(end);
  const sameMonth = s.getMonth() === e.getMonth();
  const monthFmt = new Intl.DateTimeFormat("en-IN", { month: "short" });
  if (sameMonth) {
    return `${s.getDate()} - ${e.getDate()} ${monthFmt.format(e)} ${e.getFullYear()}`;
  }
  return `${s.getDate()} ${monthFmt.format(s)} - ${e.getDate()} ${monthFmt.format(e)} ${e.getFullYear()}`;
}


/**
 * The tax suffix shown beside a price.
 *
 * TCS is a real extra charge on overseas packages, so it has to be visible
 * wherever a price is — discovering it only at checkout is exactly the kind
 * of surprise that loses a booking.
 */
export function taxSuffix(gstPercent: number, tcsPercent: number) {
  if (tcsPercent > 0) return `+ ${gstPercent}% GST & ${tcsPercent}% TCS`;
  return `+ ${gstPercent}% GST`;
}
