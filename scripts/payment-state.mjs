/**
 * Prints everything a payment touches, in one screen.
 *
 *   node --env-file=.env.local scripts/payment-state.mjs
 *   node --env-file=.env.local scripts/payment-state.mjs walayar-forest-day-out-2026
 *
 * Written for walking a booking through by hand: run it before a step and
 * after, and the diff tells you exactly what the code did.
 */
import pg from 'pg';

const slug = process.argv[2] ?? 'walayar-forest-day-out-2026';
const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();

const r = (p) => '₹' + (Number(p) / 100).toLocaleString('en-IN');
const time = (d) => d ? new Date(d).toLocaleTimeString('en-IN', { hour12: false }) : '—';
const hr = () => console.log('─'.repeat(96));

const t = (await c.query(
  `SELECT id, title, total_seats, seats_booked, trip_seats_available(id) AS available,
          price_paise, advance_paise, razorpay_enabled
     FROM trips WHERE slug = $1`, [slug])).rows[0];

if (!t) { console.log(`no trip with slug "${slug}"`); await c.end(); process.exit(1); }

hr();
console.log(`TRIP  ${t.title}`);
console.log(`      seats_booked=${t.seats_booked}/${t.total_seats}   available=${t.available}` +
  `   advance=${t.advance_paise ? r(t.advance_paise) : 'none'}   razorpay=${t.razorpay_enabled}`);
hr();

const holds = (await c.query(
  `SELECT id, seats, expires_at, released_at, booking_id,
          expires_at > now() AS live, expires_at <= now() AND released_at IS NULL AS lapsed
     FROM seat_holds WHERE trip_id = $1 ORDER BY created_at DESC LIMIT 6`, [t.id])).rows;
console.log(`SEAT HOLDS (${holds.length})`);
if (!holds.length) console.log('      none');
holds.forEach(h => {
  const state = h.booking_id ? 'CONFIRMED→booking' : h.released_at ? 'released' : h.live ? 'LIVE (blocking)' : 'lapsed (not yet released)';
  console.log(`      ${h.id.slice(0,8)}  seats=${h.seats}  expires=${time(h.expires_at)}  ${state}`);
});
hr();

const bookings = (await c.query(
  `SELECT b.id, b.reference, b.status, b.seats, b.total_paise, b.amount_paid_paise,
          b.refunded_paise, b.hold_expires_at, b.pending_hold_id, b.created_at, p.email
     FROM bookings b JOIN profiles p ON p.id = b.profile_id
    WHERE b.trip_id = $1 ORDER BY b.created_at DESC LIMIT 6`, [t.id])).rows;
console.log(`BOOKINGS (${bookings.length})`);
if (!bookings.length) console.log('      none');
for (const b of bookings) {
  console.log(`      ${b.reference}  ${b.status.padEnd(16)} seats=${b.seats}  ` +
    `paid=${r(b.amount_paid_paise)}/${r(b.total_paise)}` +
    (b.refunded_paise > 0 ? `  refunded=${r(b.refunded_paise)}` : '') +
    (b.pending_hold_id ? `  holding→${b.pending_hold_id.slice(0,8)} till ${time(b.hold_expires_at)}` : ''));
  console.log(`        ${b.email}   created ${time(b.created_at)}`);

  const pays = (await c.query(
    `SELECT method::text, status::text, amount_paise, razorpay_order_id, razorpay_payment_id, captured_at
       FROM payments WHERE booking_id = $1 ORDER BY created_at`, [b.id])).rows;
  pays.forEach(p => console.log(
    `        └ payment ${p.status.padEnd(9)} ${r(p.amount_paise).padStart(9)}  ` +
    `${p.razorpay_order_id ?? '—'}  ${p.razorpay_payment_id ?? '(unpaid)'}  ${time(p.captured_at)}`));

  // The advance/balance schedule. Only written when someone pays an advance,
  // so its absence on a paid-in-full booking is correct, not a missing row.
  const inst = (await c.query(
    `SELECT sequence, label, amount_paise, status::text, due_date, paid_at
       FROM booking_instalments WHERE booking_id = $1 ORDER BY sequence`, [b.id])).rows;
  inst.forEach(i => console.log(
    `        └ instal ${String(i.sequence)}. ${i.label.padEnd(8)} ${r(i.amount_paise).padStart(9)}  ` +
    `${i.status.padEnd(8)} due ${new Date(i.due_date).toISOString().slice(0,10)}` +
    `${i.paid_at ? '  paid ' + time(i.paid_at) : ''}`));

  const refs = (await c.query(
    `SELECT status::text, amount_paise, razorpay_refund_id, processed_at
       FROM refunds WHERE booking_id = $1 ORDER BY created_at`, [b.id])).rows;
  refs.forEach(x => console.log(
    `        └ refund  ${x.status.padEnd(9)} ${r(x.amount_paise).padStart(9)}  ` +
    `${x.razorpay_refund_id ?? '(not sent)'}  ${time(x.processed_at)}`));
}
hr();

const ev = (await c.query(
  `SELECT event_id, event, signature_verified, processed_at, processing_error
     FROM razorpay_events ORDER BY created_at DESC LIMIT 6`)).rows;
console.log(`WEBHOOK EVENTS (${ev.length})`);
if (!ev.length) console.log('      none yet');
ev.forEach(e => console.log(
  `      ${e.event.padEnd(18)} ${e.event_id.slice(0,22).padEnd(24)} verified=${e.signature_verified}` +
  `  ${e.processed_at ? 'processed' : 'PENDING'}${e.processing_error ? '  ⚠ ' + e.processing_error.slice(0,44) : ''}`));
hr();

const mail = (await c.query(
  `SELECT template, to_email, status::text, dedupe_key FROM email_log ORDER BY created_at DESC LIMIT 4`)).rows;
console.log(`EMAILS (${mail.length})`);
if (!mail.length) console.log('      none');
mail.forEach(m => console.log(`      ${m.template.padEnd(20)} ${m.to_email.padEnd(28)} ${m.status}`));
hr();

await c.end();
