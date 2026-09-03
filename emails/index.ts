/**
 * Every outbound email, in one place.
 *
 * Templates are one per file: each exports a function returning a plain
 * `{ subject, html, text }`, and knows nothing about sending. `send.ts` is
 * the only thing that talks to Resend, so a template can be rendered and
 * eyeballed without a mail server, and a send can be logged and deduped
 * without every caller remembering to.
 *
 *   import { sendEmail, bookingConfirmedEmail } from "@/emails";
 */

export { sendEmail, type SendResult } from "./send";

export { verificationEmail } from "./verification";
export { bookingConfirmedEmail } from "./bookingConfirmed";
export { balanceReminderEmail } from "./balanceReminder";
export { paymentReceivedEmail } from "./paymentReceived";
export { bookingCancelledEmail } from "./bookingCancelled";
export { creditIssuedEmail } from "./creditIssued";
export { refundProcessedEmail } from "./refundProcessed";
export { refundFailedAdminEmail } from "./refundFailedAdmin";
export { refundProcessedAdminEmail } from "./refundProcessedAdmin";
export { seatUnavailableEmail } from "./seatUnavailable";
export { seatUnavailableAdminEmail } from "./seatUnavailableAdmin";

// The shell, for anyone writing a new template.
export { layout, button, escapeHtml, NAVY, CREAM, YELLOW, MUTED } from "./layout";
