import { cn } from "@/lib/utils";

/** Shared chrome for admin screens. Plain, dense, unbranded on purpose —
 *  this is a tool, not a marketing page. */

export function Panel({
  title,
  action,
  children,
  className,
}: {
  title?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("mb-5 overflow-hidden rounded-[14px] border border-[#e3e7ee] bg-white shadow-sm", className)}>
      {(title || action) && (
        <header className="flex items-center gap-3.5 border-b border-[#e3e7ee] px-5 py-[15px]">
          {title && <h2 className="text-[0.98rem] font-semibold">{title}</h2>}
          {action && <div className="ml-auto flex items-center gap-2">{action}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

const CHIP: Record<string, string> = {
  ok: "bg-[#e6f5ee] text-[#0f8a5f]",
  warn: "bg-[#fdf1dc] text-[#b26a00]",
  bad: "bg-[#fdeaea] text-[#c33a3a]",
  info: "bg-[#e4f2f7] text-[#1d6d8a]",
  mute: "bg-[#eef1f6] text-[#5a6785]",
};

export function Chip({
  tone = "mute",
  children,
}: {
  tone?: keyof typeof CHIP | string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-[3px] text-[0.75rem] font-semibold",
        CHIP[tone] ?? CHIP.mute,
      )}
    >
      <span className="h-1.5 w-1.5 flex-none rounded-full bg-current" />
      {children}
    </span>
  );
}

/** Status → chip tone, kept in one place so the colour semantics never
 *  disagree between the bookings table and the dashboard. */
export const BOOKING_TONE: Record<string, { tone: string; label: string }> = {
  CONFIRMED: { tone: "ok", label: "Confirmed" },
  REQUESTED: { tone: "info", label: "Request" },
  PENDING_PAYMENT: { tone: "warn", label: "Pending payment" },
  CANCELLED: { tone: "bad", label: "Cancelled" },
  REFUNDED: { tone: "mute", label: "Refunded in full" },
  PARTIALLY_REFUNDED: { tone: "mute", label: "Partly refunded" },
  CARRIED_FORWARD: { tone: "info", label: "Carried forward" },
  EXPIRED: { tone: "mute", label: "Expired" },
};

export const PAYMENT_TONE: Record<string, { tone: string; label: string }> = {
  PAID: { tone: "ok", label: "Paid in full" },
  PARTIAL: { tone: "warn", label: "Partly paid" },
  UNPAID: { tone: "bad", label: "Unpaid" },
};

/**
 * Where a trip is in its editorial life.
 *
 * Distinct from `isActive`, which is the master on/off switch and outranks
 * this. A trip must be BOTH live and active to appear on the site — so a
 * finished trip can be pulled temporarily without being demoted back to
 * Draft and losing the fact that it was ever finished.
 */
export const TRIP_TONE: Record<string, { tone: string; label: string }> = {
  PUBLISHED: { tone: "ok", label: "Live on site" },
  DRAFT: { tone: "warn", label: "Draft" },
  ARCHIVED: { tone: "mute", label: "Archived" },
};

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="px-5 py-14 text-center">
      <p className="text-[0.95rem] font-medium">{title}</p>
      <p className="mx-auto mt-1.5 max-w-sm text-[0.85rem] leading-relaxed text-[#8b96ad]">{body}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
