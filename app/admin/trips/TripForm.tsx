"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, CheckCircle2, ExternalLink, Eye, Loader2 } from "lucide-react";

import { ImageUpload } from "@/components/admin/ImageUpload";
import { ItineraryEditor } from "@/components/admin/ItineraryEditor";
import { MoodboardEditor } from "@/components/admin/MoodboardEditor";
import { ReviewsEditor, type ReviewDraft } from "@/components/admin/ReviewsEditor";
import { RichTextEditor } from "@/components/admin/RichTextEditor";
import { cn } from "@/lib/utils";

import { createTrip, updateTrip, type TripFormState } from "./actions";

export type TripFormValues = {
  id?: string;
  slug?: string;
  title?: string;
  batchName?: string | null;
  tagline?: string | null;
  destination?: string | null;
  category?: string | null;
  cardImage?: string | null;
  heroImage?: string | null;
  startDate?: string;
  endDate?: string;
  durationLabel?: string | null;
  startingFrom?: string | null;
  ageGroup?: string | null;
  totalSeats?: number;
  seatsBooked?: number;
  minParticipants?: number;
  price?: number;
  comparePrice?: number | null;
  offerLabel?: string | null;
  offerEndsAt?: string | null;
  advance?: number | null;
  gstPercent?: number;
  tcsPercent?: number;
  instalmentCount?: number;
  razorpayEnabled?: boolean;
  autoCloseWhenFull?: boolean;
  showSeatsLeft?: boolean;
  status?: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  isFeatured?: boolean;
  introduction?: unknown;
  itinerary?: unknown;
  inclusions?: unknown;
  exclusions?: unknown;
  thingsToKnow?: unknown;
  cancellationPolicy?: unknown;
  moodboard?: unknown;
  reviews?: ReviewDraft[];
};

const CATEGORIES = [
  "DOT Signatures", "Long Trips", "Coastal Carnivals", "Cultural Feast",
  "Monsoon Trips", "Western Ghats", "Travel Festival Specials", "Abroad",
];

export function TripForm({
  values = {},
  mode,
  saved,
}: {
  values?: TripFormValues;
  mode: "create" | "edit";
  saved?: boolean;
}) {
  const action = mode === "create" ? createTrip : updateTrip;
  const [state, submit, pending] = useActionState<TripFormState, FormData>(action, {});
  const err = (f: string) => state.fieldErrors?.[f];

  const [price, setPrice] = useState(values.price ?? 0);
  const [gst, setGst] = useState(values.gstPercent ?? 5);
  const [tcs, setTcs] = useState(values.tcsPercent ?? 0);
  const [advance, setAdvance] = useState(values.advance ?? 0);
  const [startDate, setStartDate] = useState(values.startDate ?? "");
  const [endDate, setEndDate] = useState(values.endDate ?? "");

  // Derived, never typed — a hand-written "12 days" on a 3-day trip is the
  // kind of thing nobody notices until a customer does.
  const duration = describeDuration(startDate, endDate);

  // Mirrors the maths the booking flow will do, so the numbers are visible
  // while pricing rather than a surprise at checkout.
  const gstAmount = Math.round(price * (gst / 100));
  // TCS is charged on the package value, not on the GST-inclusive figure.
  const tcsAmount = Math.round(price * (tcs / 100));
  const total = price + gstAmount + tcsAmount;
  const balance = Math.max(total - advance, 0);

  return (
    <form action={submit} className="pb-24">
      {values.id && <input type="hidden" name="id" value={values.id} />}

      <header className="mb-6 flex flex-wrap items-start gap-4">
        <div className="min-w-0">
          <Link
            href="/admin/trips"
            className="mb-1 inline-flex items-center gap-1.5 text-[0.82rem] text-[#5a6785] hover:text-navy"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> All trips
          </Link>
          <h1 className="font-display text-[1.85rem] font-semibold tracking-tight">
            {mode === "create" ? "New trip" : values.title}
          </h1>
          <p className="mt-0.5 text-[0.85rem] text-[#8b96ad]">
            {mode === "create"
              ? "Save as a draft first — nothing goes live until you publish."
              : `${values.seatsBooked ?? 0} of ${values.totalSeats ?? 0} seats booked`}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {mode === "edit" && values.id && (
            <Link
              href={`/preview/trips/${values.id}`}
              target="_blank"
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#e3e7ee] bg-white px-3.5 py-2 text-[0.85rem] hover:bg-[#eef1f6]"
            >
              <Eye className="h-3.5 w-3.5" /> Preview
            </Link>
          )}
          {mode === "edit" && values.slug && values.status === "PUBLISHED" && (
            <Link
              href={`/trips/${values.slug}`}
              target="_blank"
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#e3e7ee] bg-white px-3.5 py-2 text-[0.85rem] hover:bg-[#eef1f6]"
            >
              Live page <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          )}
          <button
            type="submit"
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-lg bg-navy px-4 py-2 text-[0.85rem] font-medium text-cream hover:bg-[#1b2f56] disabled:opacity-60"
          >
            {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {pending ? "Saving…" : mode === "create" ? "Create trip" : "Save changes"}
          </button>
        </div>
      </header>

      {state.error && <Banner tone="bad">{state.error}</Banner>}
      {state.fieldErrors && (
        <Banner tone="bad">Some fields need fixing — they&apos;re marked in red below.</Banner>
      )}
      {saved && !state.error && !state.fieldErrors && (
        <Banner tone="ok">
          {values.status === "PUBLISHED" ? (
            "Saved. Changes are live on the site."
          ) : (
            <span>
              Saved as a draft — not visible on the site yet.{" "}
              <Link
                href={`/preview/trips/${values.id}`}
                target="_blank"
                className="font-semibold underline underline-offset-2"
              >
                Preview how it will look
              </Link>
              , or set Status to Published below.
            </span>
          )}
        </Banner>
      )}

      {/* ── Basics ── */}
      <Section title="Basics">
        <Grid>
          <Field label="Trip title" error={err("title")} className="sm:col-span-2">
            <input name="title" defaultValue={values.title ?? ""} required placeholder="The Royal Trilogy of Rajasthan" className={input} />
          </Field>
          <Field
            label="Batch name"
            hint="Only you see this. Tells apart repeat runs — “Rajasthan 2026 · Batch 1”."
            error={err("batchName")}
          >
            <input name="batchName" defaultValue={values.batchName ?? ""} placeholder="Rajasthan 2026 · Batch 1" className={input} />
          </Field>
          <Field label="Category">
            <select name="category" defaultValue={values.category ?? ""} className={input}>
              <option value="">Uncategorised</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Tagline" className="sm:col-span-2">
            <input name="tagline" defaultValue={values.tagline ?? ""} placeholder="Six days across lakes, dunes and pink-city forts" className={input} />
          </Field>
        </Grid>
      </Section>

      {/* ── Dates & capacity ── */}
      <Section title="Dates & capacity">
        <Grid>
          <Field label="Start date" error={err("startDate")}>
            <input type="date" name="startDate" value={startDate} onChange={(e) => setStartDate(e.target.value)} required className={input} />
          </Field>
          <Field label="End date" error={err("endDate")}>
            {/* The picker can't offer a date before departure. The server
                still checks — a form can always be submitted around. */}
            <input type="date" name="endDate" value={endDate} onChange={(e) => setEndDate(e.target.value)} min={startDate || undefined} required className={input} />
          </Field>
          <Field label="Duration" hint="Worked out from the dates">
            <div className={cn(input, "flex items-center bg-[#f6f7f9] text-[#5a6785]")}>
              {duration ?? "Pick both dates"}
            </div>
          </Field>
          <Field label="Starting from">
            <input name="startingFrom" defaultValue={values.startingFrom ?? ""} placeholder="Coimbatore" className={input} />
          </Field>
          <Field label="Age group">
            <input name="ageGroup" defaultValue={values.ageGroup ?? ""} placeholder="18 - 39 years" className={input} />
          </Field>
          <Field
            label="Total seats"
            error={err("totalSeats")}
            hint={mode === "edit" ? `${values.seatsBooked ?? 0} already booked` : undefined}
          >
            <input type="number" name="totalSeats" min={1} defaultValue={values.totalSeats ?? 12} required className={input} />
          </Field>
          <Field label="Minimum participants" hint="Below this, the trip is cancelled" error={err("minParticipants")}>
            <input type="number" name="minParticipants" min={1} defaultValue={values.minParticipants ?? 1} className={input} />
          </Field>
        </Grid>
      </Section>

      {/* ── Pricing ── */}
      <Section title="Pricing" subtitle="Everything here drives the payment maths, so it stays as real fields.">
        <Grid>
          <Field label="Price per person (₹)" error={err("price")}>
            <input type="number" name="price" min={0} value={price} onChange={(e) => setPrice(Number(e.target.value))} required className={input} />
          </Field>
          <Field label="Was price (₹)" hint="Optional. Struck through — display only, never charged." error={err("comparePrice")}>
            <input type="number" name="comparePrice" min={0} defaultValue={values.comparePrice ?? ""} className={input} />
          </Field>
          <Field label="Offer label">
            <input name="offerLabel" defaultValue={values.offerLabel ?? ""} placeholder="Early bird" className={input} />
          </Field>
          <Field label="GST %">
            <input type="number" name="gstPercent" min={0} max={100} value={gst} onChange={(e) => setGst(Number(e.target.value))} className={input} />
          </Field>
          <Field
            label="TCS %"
            hint="Overseas trips only. Leave 0 for trips inside India."
          >
            <input type="number" name="tcsPercent" min={0} max={100} value={tcs} onChange={(e) => setTcs(Number(e.target.value))} className={input} />
          </Field>
          <Field label="Advance to book (₹)" hint="Blank means pay in full" error={err("advance")}>
            <input type="number" name="advance" min={0} value={advance || ""} onChange={(e) => setAdvance(Number(e.target.value))} className={input} />
          </Field>
        </Grid>

        {/* What the customer will actually be asked for. */}
        <div className="mt-4 overflow-hidden rounded-xl border border-[#e3e7ee]">
          <Row label={`Package price`} value={price} />
          <Row label={`GST @ ${gst}%`} value={gstAmount} />
          {tcs > 0 && <Row label={`TCS @ ${tcs}%`} value={tcsAmount} />}
          <Row label="Customer pays in total" value={total} strong />
          {advance > 0 && (
            <>
              <Row label="Pay now to book" value={advance} highlight />
              <Row label="Balance before departure" value={balance} muted />
            </>
          )}
        </div>
      </Section>

      {/* ── Photos ── */}
      <Section
        title="Photos"
        subtitle="Upload straight from your phone — photos are resized automatically. Two separate crops, because squeezing one into the other cuts heads and domes in half."
      >
        <div className="grid gap-5 sm:grid-cols-[220px_1fr]">
          <ImageUpload
            name="cardImage"
            slot="card"
            label="Card photo"
            hint="Portrait. Used on the homepage grid."
            aspect="5 / 6"
            defaultValue={values.cardImage}
          />
          <ImageUpload
            name="heroImage"
            slot="hero"
            label="Hero photo"
            hint="Wide. The banner across the top of the trip page."
            aspect="16 / 9"
            defaultValue={values.heroImage}
          />
        </div>
      </Section>

      {/* ── Content ── */}
      <Section
        title="Trip content"
        subtitle="All free-form. Add as much or as little as you like — empty sections simply don't appear on the page."
      >
        <div className="flex flex-col gap-5">
          <Editor name="introduction" label="Introduction" hint="The opening pitch, in your voice. Use the photo button in the toolbar to drop images in anywhere." defaultValue={values.introduction} />
          <div className="flex flex-col gap-1.5">
            <span className="text-[0.82rem] font-semibold text-[#16203a]">Day-by-day itinerary</span>
            <span className="-mt-0.5 text-[0.78rem] text-[#8b96ad]">
              Add a card per day. Each one takes its own text and a photo, and
              they can be reordered — the day numbers renumber themselves.
            </span>
            <ItineraryEditor name="itinerary" defaultValue={values.itinerary} />
          </div>

          <Editor name="inclusions" label="What's included" hint="A bullet list works well here." defaultValue={values.inclusions} />
          <Editor name="exclusions" label="What's not included" defaultValue={values.exclusions} />
          <Editor name="thingsToKnow" label="Things to know" hint="Booking process, money to carry, who can join — use headings to break it up." defaultValue={values.thingsToKnow} minHeight={220} />
          <Editor name="cancellationPolicy" label="Cancellation policy" hint="This replaces the generic policy on the trip page." defaultValue={values.cancellationPolicy} />
        </div>
      </Section>

      {/* ── Moodboard ── */}
      <Section
        title="Trip moodboard"
        subtitle="Optional. A quick read on what kind of trip this is — it appears near the top of the trip page, so someone can tell in two seconds whether it's a hike or a hammock."
      >
        <MoodboardEditor name="moodboard" defaultValue={values.moodboard} />
      </Section>

      {/* ── Reviews ── */}
      <Section
        title="Reviews"
        subtitle="Optional. Up to 3 quotes from people who've done this trip — they appear just before the booking section, where they do the most work."
      >
        <ReviewsEditor
          name="reviews"
          defaultValue={values.reviews}
          tripTitlePlaceholder={values.title ? `${values.title} · 2025` : "Which batch they travelled with"}
        />
      </Section>

      {/* ── Publishing ── */}
      <Section title="Booking & publishing">
        <div className="flex flex-col">
          <Toggle
            name="razorpayEnabled"
            defaultChecked={values.razorpayEnabled ?? false}
            title="Accept online payment (Razorpay)"
            body="When off, the booking form still works — it records a booking request and emails you and the customer, and you collect payment yourself."
          />
          <Toggle
            name="autoCloseWhenFull"
            defaultChecked={values.autoCloseWhenFull ?? true}
            title="Close bookings when full"
            body="Stops new bookings the moment every seat is taken."
          />
          <Toggle
            name="showSeatsLeft"
            defaultChecked={values.showSeatsLeft ?? true}
            title="Show the seats-left counter"
            body="Displays “only 3 seats left” on the card and trip page."
          />
          <Toggle
            name="isFeatured"
            defaultChecked={values.isFeatured ?? false}
            title="Show as the big card"
            body="Every published trip already appears on the homepage. This only makes one of them span the grid as a large highlight — turning it off doesn't hide the trip."
          />

          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[#eef1f6] pt-4">
            <div>
              <b className="block text-[0.89rem] font-semibold">Status</b>
              <small className="mt-0.5 block text-[0.8rem] text-[#8b96ad]">
                This is what controls visibility. An inactive trip is invisible on the site;
                activating puts it on the homepage and makes it bookable. You can also flip this
                from the trips list.
              </small>
            </div>
            <select name="status" defaultValue={values.status ?? "DRAFT"} className={cn(input, "w-auto")}>
              <option value="DRAFT">Inactive — not on the site</option>
              <option value="PUBLISHED">Active — live on the site</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </div>
        </div>
      </Section>

      {/* Sticky save so it's always reachable on a long form. */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[#e3e7ee] bg-white/95 px-5 py-3 backdrop-blur md:pl-[262px]">
        <div className="flex items-center gap-3">
          <span className="text-[0.82rem] text-[#8b96ad]">
            {mode === "create" ? "Not saved yet" : "Changes apply as soon as you save"}
          </span>
          <Link href="/admin/trips" className="ml-auto rounded-lg border border-[#e3e7ee] px-3.5 py-2 text-[0.85rem] hover:bg-[#eef1f6]">
            Cancel
          </Link>
          <button
            type="submit"
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-lg bg-navy px-4 py-2 text-[0.85rem] font-medium text-cream hover:bg-[#1b2f56] disabled:opacity-60"
          >
            {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {pending ? "Saving…" : mode === "create" ? "Create trip" : "Save changes"}
          </button>
        </div>
      </div>
    </form>
  );
}

/* ───────────────────────── bits ───────────────────────── */

/** "6 Days, 5 Nights" from two ISO dates. */
function describeDuration(start: string, end: string): string | null {
  if (!start || !end) return null;
  const from = new Date(start);
  const to = new Date(end);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) return null;

  const days = Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1;
  const nights = days - 1;
  const d = `${days} ${days === 1 ? "Day" : "Days"}`;
  return nights > 0 ? `${d}, ${nights} ${nights === 1 ? "Night" : "Nights"}` : d;
}

const input =
  "w-full rounded-xl border border-[#e3e7ee] bg-white px-3.5 py-2.5 text-[0.9rem] outline-none transition focus:border-teal focus:ring-[3px] focus:ring-teal/12";

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="mb-5 overflow-hidden rounded-[14px] border border-[#e3e7ee] bg-white shadow-sm">
      <header className="border-b border-[#e3e7ee] px-5 py-[15px]">
        <h2 className="text-[0.98rem] font-semibold">{title}</h2>
        {subtitle && <p className="mt-1 max-w-2xl text-[0.82rem] leading-relaxed text-[#8b96ad]">{subtitle}</p>}
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{children}</div>;
}

function Field({
  label, hint, error, className, children,
}: {
  label: string; hint?: string; error?: string; className?: string; children: React.ReactNode;
}) {
  return (
    <label className={cn("flex flex-col gap-1.5", className)}>
      <span className="text-[0.82rem] font-semibold text-[#16203a]">{label}</span>
      {children}
      {error ? (
        <span className="flex items-center gap-1 text-[0.78rem] font-medium text-[#c33a3a]">
          <AlertCircle className="h-3 w-3 flex-none" /> {error}
        </span>
      ) : hint ? (
        <span className="text-[0.78rem] text-[#8b96ad]">{hint}</span>
      ) : null}
    </label>
  );
}

function Editor({
  name, label, hint, defaultValue, minHeight,
}: {
  name: string; label: string; hint?: string; defaultValue?: unknown; minHeight?: number;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[0.82rem] font-semibold text-[#16203a]">{label}</span>
      {hint && <span className="-mt-0.5 text-[0.78rem] text-[#8b96ad]">{hint}</span>}
      <RichTextEditor name={name} defaultValue={defaultValue} minHeight={minHeight} />
    </div>
  );
}

function Toggle({
  name, title, body, defaultChecked,
}: {
  name: string; title: string; body: string; defaultChecked: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-5 border-b border-[#eef1f6] py-4">
      <span>
        <b className="block text-[0.89rem] font-semibold">{title}</b>
        <small className="mt-0.5 block max-w-[52ch] text-[0.8rem] leading-relaxed text-[#8b96ad]">{body}</small>
      </span>
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="peer sr-only" />
      <span className="relative mt-0.5 h-6 w-[42px] flex-none rounded-full bg-[#e3e7ee] transition peer-checked:bg-teal peer-focus-visible:ring-2 peer-focus-visible:ring-teal/40 after:absolute after:left-[3px] after:top-[3px] after:h-[18px] after:w-[18px] after:rounded-full after:bg-white after:shadow-sm after:transition peer-checked:after:translate-x-[18px]" />
    </label>
  );
}

function Row({
  label, value, strong, muted, highlight,
}: {
  label: string; value: number; strong?: boolean; muted?: boolean; highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex justify-between gap-4 border-b border-[#eef1f6] px-4 py-2.5 text-[0.88rem] last:border-0",
        strong && "bg-navy font-semibold text-cream",
        highlight && "bg-[#fdf6e3] font-semibold",
      )}
    >
      <span className={cn(!strong && "text-[#5a6785]", strong && "text-cream/75")}>{label}</span>
      <span className={cn("tabular-nums", muted && "text-[#8b96ad]")}>
        ₹{value.toLocaleString("en-IN")}
      </span>
    </div>
  );
}

function Banner({ tone, children }: { tone: "ok" | "bad"; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "mb-4 flex items-start gap-2.5 rounded-xl border px-4 py-3 text-[0.86rem]",
        tone === "ok"
          ? "border-[#bfe6d3] bg-[#e6f5ee] text-[#0f8a5f]"
          : "border-[#f0cfcf] bg-[#fdeaea] text-[#c33a3a]",
      )}
    >
      {tone === "ok" ? <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none" /> : <AlertCircle className="mt-0.5 h-4 w-4 flex-none" />}
      {children}
    </div>
  );
}
