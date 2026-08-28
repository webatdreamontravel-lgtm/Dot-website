"use client";

import { PhoneInput } from "@/components/shared/PhoneInput";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { AlertCircle, Check, Loader2, Minus, Plus, Search, UserPlus, X } from "lucide-react";

import { toRupees } from "@/lib/booking/pricing";
import { DEFAULT_STATE, TAMIL_NADU_CITIES } from "@/lib/data/indianStates";
import { formatINR } from "@/lib/utils";
import { Panel } from "../../ui";
import { createBookingForCustomer, findCustomers, type CustomerHit } from "./actions";

type TripOption = {
  id: string;
  title: string;
  batchName: string | null;
  seatsAvailable: number;
  pricePaise: number;
  gstPercent: number;
  tcsPercent: number;
  advancePaise: number | null;
  startDate: string;
};

type Traveller = { fullName: string; phone: string; email: string };

const blank = (): Traveller => ({ fullName: "", phone: "", email: "" });

export function NewBookingForm({
  trips,
  initialTripId,
}: {
  trips: TripOption[];
  initialTripId?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [tripId, setTripId] = useState(initialTripId ?? trips[0]?.id ?? "");
  const trip = trips.find((t) => t.id === tripId);

  // ── Customer: found, or being created ──
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<CustomerHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [picked, setPicked] = useState<CustomerHit | null>(null);
  const [creating, setCreating] = useState(false);
  const [fresh, setFresh] = useState({
    fullName: "", email: "", phone: "", city: "", state: DEFAULT_STATE, gender: "",
  });

  const [seats, setSeats] = useState(1);
  const [travellers, setTravellers] = useState<Traveller[]>([blank()]);
  const [source, setSource] = useState("ADMIN_OFFLINE");
  const [status, setStatus] = useState("REQUESTED");
  const [notes, setNotes] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [paymentReference, setPaymentReference] = useState("");

  // Debounced search — one request per pause in typing, not per keystroke.
  // All the state changes happen inside the timeout rather than during the
  // effect body, which would cascade a second render on every keystroke.
  useEffect(() => {
    if (picked || creating) return;
    const term = query.trim();

    const timer = setTimeout(async () => {
      if (term.length < 2) {
        setHits([]);
        return;
      }
      setSearching(true);
      try {
        setHits(await findCustomers(term));
      } finally {
        setSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query, picked, creating]);

  const maxSeats = trip?.seatsAvailable ?? 1;

  const setSeatCount = (n: number) => {
    const next = Math.min(Math.max(n, 1), Math.max(maxSeats, 1));
    setSeats(next);
    setTravellers((prev) =>
      next > prev.length
        ? [...prev, ...Array.from({ length: next - prev.length }, blank)]
        : prev.slice(0, next),
    );
  };

  const patchTraveller = (i: number, changes: Partial<Traveller>) =>
    setTravellers((prev) => prev.map((t, idx) => (idx === i ? { ...t, ...changes } : t)));

  // The lead traveller is nearly always the customer — save the retyping.
  const copyCustomerToLead = () => {
    const name = picked?.fullName ?? fresh.fullName;
    const phone = picked?.phone ?? fresh.phone;
    const email = picked?.email ?? fresh.email;
    if (name) patchTraveller(0, { fullName: name, phone: phone ?? "", email: email ?? "" });
  };

  const price = trip
    ? (() => {
        const subtotal = trip.pricePaise * seats;
        const round = (p: number) => Math.round(p / 100) * 100;
        const gst = round((subtotal * trip.gstPercent) / 100);
        const tcs = round((subtotal * trip.tcsPercent) / 100);
        return { subtotal, gst, tcs, total: subtotal + gst + tcs };
      })()
    : null;

  const submit = () => {
    setError(null);
    start(async () => {
      const result = await createBookingForCustomer({
        tripId,
        profileId: picked?.id ?? "",
        newCustomer: creating
          ? {
              fullName: fresh.fullName,
              email: fresh.email,
              phone: fresh.phone,
              city: fresh.city,
              state: fresh.state,
              gender: fresh.gender as "MALE",
            }
          : undefined,
        seats,
        travellers,
        source: source as "ADMIN_OFFLINE",
        status: status as "REQUESTED",
        notes,
        paymentAmount,
        paymentMethod: paymentMethod as "CASH",
        paymentReference,
      });

      if (result.ok) router.push(`/admin/bookings/${result.reference}`);
      else setError(result.error);
    });
  };

  const customerChosen = Boolean(picked) || creating;

  return (
    <div className="grid gap-5 lg:grid-cols-[1.3fr_0.7fr] lg:items-start">
      <div>
        {error && (
          <p
            role="alert"
            className="mb-4 flex items-start gap-2 rounded-xl border border-[#f0c9c9] bg-[#fdf5f5] px-4 py-3 text-[0.87rem] text-navy"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 flex-none text-[#c33a3a]" />
            {error}
          </p>
        )}

        <Panel title="1 · Which trip">
          <div className="px-5 py-4">
            <select value={tripId} onChange={(e) => setTripId(e.target.value)} className={control}>
              {trips.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                  {t.batchName ? ` · ${t.batchName}` : ""} — {t.seatsAvailable} seat
                  {t.seatsAvailable === 1 ? "" : "s"} left
                </option>
              ))}
            </select>
            {trip && trip.seatsAvailable === 0 && (
              <p className="mt-2 text-[0.82rem] font-medium text-[#c33a3a]">
                This trip is full — no seats can be reserved.
              </p>
            )}
          </div>
        </Panel>

        <Panel
          title="2 · Who's it for"
          action={
            customerChosen ? (
              <button
                type="button"
                onClick={() => {
                  setPicked(null);
                  setCreating(false);
                  setQuery("");
                }}
                className="inline-flex items-center gap-1 text-[0.82rem] text-[#5a6785] hover:text-navy"
              >
                <X className="h-3.5 w-3.5" /> Change
              </button>
            ) : null
          }
        >
          <div className="px-5 py-4">
            {picked ? (
              <div className="flex items-center gap-3 rounded-xl border border-[#d7e8e2] bg-[#f2f9f6] px-4 py-3">
                <Check className="h-4 w-4 flex-none text-[#0f8a5f]" />
                <div>
                  <p className="text-[0.9rem] font-semibold text-navy">
                    {picked.fullName ?? picked.email}
                  </p>
                  <p className="text-[0.8rem] text-[#5a6785]">
                    {[picked.phone, picked.email].filter(Boolean).join(" · ")}
                    {picked.bookings > 0 && ` · ${picked.bookings} previous booking${picked.bookings === 1 ? "" : "s"}`}
                  </p>
                </div>
              </div>
            ) : creating ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Full name" className="sm:col-span-2">
                  <input value={fresh.fullName} onChange={(e) => setFresh({ ...fresh, fullName: e.target.value })} className={control} placeholder="As on their ID" />
                </Field>
                <Field label="Email">
                  <input value={fresh.email} onChange={(e) => setFresh({ ...fresh, email: e.target.value })} type="email" className={control} placeholder="they@example.com" />
                </Field>
                <Field label="Phone">
                  <PhoneInput
                    value={fresh.phone}
                    onChange={(v) => setFresh({ ...fresh, phone: v })}
                    className={control}
                  />
                </Field>
                <Field label="City">
                  <select value={fresh.city} onChange={(e) => setFresh({ ...fresh, city: e.target.value })} className={control}>
                    <option value="">Not given</option>
                    {TAMIL_NADU_CITIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Gender">
                  <select value={fresh.gender} onChange={(e) => setFresh({ ...fresh, gender: e.target.value })} className={control}>
                    <option value="">Not given</option>
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                  </select>
                </Field>
                <p className="sm:col-span-2 rounded-lg bg-[#eef1f6] px-3 py-2 text-[0.8rem] leading-relaxed text-[#5a6785]">
                  An account is created for this email. When they later sign up with it, they set
                  their own password and this booking is already in their trips.
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 rounded-lg border border-[#e3e7ee] bg-white px-3 py-[7px] focus-within:border-teal">
                  <Search className="h-3.5 w-3.5 flex-none text-[#8b96ad]" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search by name, phone or email…"
                    className="w-full border-0 bg-transparent text-[0.88rem] outline-none"
                    autoFocus
                  />
                  {searching && <Loader2 className="h-3.5 w-3.5 animate-spin text-[#8b96ad]" />}
                </div>

                {hits.length > 0 && (
                  <ul className="mt-2 overflow-hidden rounded-xl border border-[#e3e7ee]">
                    {hits.map((h) => (
                      <li key={h.id} className="border-b border-[#eef1f6] last:border-0">
                        <button
                          type="button"
                          onClick={() => {
                            setPicked(h);
                            setHits([]);
                          }}
                          className="block w-full px-3.5 py-2.5 text-left transition hover:bg-[#fafbfd]"
                        >
                          <span className="text-[0.88rem] font-medium text-navy">
                            {h.fullName ?? h.email}
                          </span>
                          <span className="block text-[0.78rem] text-[#8b96ad]">
                            {[h.phone, h.email].filter(Boolean).join(" · ")}
                            {h.bookings > 0 && ` · ${h.bookings} booking${h.bookings === 1 ? "" : "s"}`}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                {query.trim().length >= 2 && !searching && hits.length === 0 && (
                  <p className="mt-2 text-[0.83rem] text-[#8b96ad]">
                    Nobody matches “{query.trim()}”.
                  </p>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setCreating(true);
                    // Carry across whatever they typed — it's usually the name.
                    const term = query.trim();
                    if (term.includes("@")) setFresh((f) => ({ ...f, email: term }));
                    else if (/^\+?[\d\s-]{6,}$/.test(term)) setFresh((f) => ({ ...f, phone: term }));
                    else if (term) setFresh((f) => ({ ...f, fullName: term }));
                  }}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-[#c3cad8] px-3 py-2 text-[0.83rem] font-medium text-[#5a6785] transition hover:border-teal hover:text-navy"
                >
                  <UserPlus className="h-3.5 w-3.5" /> New customer
                </button>
              </>
            )}
          </div>
        </Panel>

        <Panel title="3 · Travellers">
          <div className="px-5 py-4">
            <div className="mb-4 flex flex-wrap items-center gap-3 border-b border-[#eef1f6] pb-4">
              <div>
                <p className="text-[0.85rem] font-medium text-navy">Seats</p>
                <p className="text-[0.78rem] text-[#8b96ad]">{maxSeats} available</p>
              </div>
              <div className="ml-auto flex items-center gap-1">
                <SeatBtn onClick={() => setSeatCount(seats - 1)} disabled={seats <= 1} label="One fewer">
                  <Minus className="h-3.5 w-3.5" />
                </SeatBtn>
                <span className="w-9 text-center font-display text-lg tabular-nums">{seats}</span>
                <SeatBtn onClick={() => setSeatCount(seats + 1)} disabled={seats >= maxSeats} label="One more">
                  <Plus className="h-3.5 w-3.5" />
                </SeatBtn>
              </div>
              {customerChosen && (
                <button
                  type="button"
                  onClick={copyCustomerToLead}
                  className="w-full text-left text-[0.8rem] text-teal underline underline-offset-2 sm:w-auto"
                >
                  Use the customer as traveller 1
                </button>
              )}
            </div>

            <div className="flex flex-col gap-4">
              {travellers.map((t, i) => (
                <div key={i}>
                  <p className="mb-2 text-[0.72rem] font-semibold uppercase tracking-[0.1em] text-[#8b96ad]">
                    Traveller {i + 1}
                  </p>
                  <div className="grid gap-2.5 sm:grid-cols-3">
                    <input value={t.fullName} onChange={(e) => patchTraveller(i, { fullName: e.target.value })} placeholder="Full name" className={control} />
                    <PhoneInput
                      value={t.phone}
                      onChange={(v) => patchTraveller(i, { phone: v })}
                      className={control}
                    />
                    <input value={t.email} onChange={(e) => patchTraveller(i, { email: e.target.value })} placeholder="Email" className={control} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Panel>

        <Panel title="4 · How it came in">
          <div className="grid gap-3 px-5 py-4 sm:grid-cols-2">
            <Field label="Source">
              <select value={source} onChange={(e) => setSource(e.target.value)} className={control}>
                <option value="ADMIN_OFFLINE">Offline</option>
                <option value="WHATSAPP">WhatsApp</option>
                <option value="FESTIVAL">Festival</option>
                <option value="WEB">Website</option>
              </select>
            </Field>
            <Field label="Status">
              <select value={status} onChange={(e) => setStatus(e.target.value)} className={control}>
                <option value="REQUESTED">Request — not paid yet</option>
                <option value="CONFIRMED">Confirmed</option>
              </select>
            </Field>
            <Field label="Internal notes" className="sm:col-span-2">
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={control} />
            </Field>
          </div>
        </Panel>

        <Panel title="5 · Money taken now (optional)">
          <div className="grid gap-3 px-5 py-4 sm:grid-cols-3">
            <Field label="Amount">
              <input value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} inputMode="decimal" placeholder="Leave blank if none" className={control} />
            </Field>
            <Field label="Method">
              <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className={control}>
                <option value="CASH">Cash</option>
                <option value="UPI_MANUAL">UPI</option>
                <option value="BANK_TRANSFER">Bank transfer</option>
                <option value="OTHER">Other</option>
              </select>
            </Field>
            <Field label="Reference / UTR">
              <input value={paymentReference} onChange={(e) => setPaymentReference(e.target.value)} placeholder="Optional" className={control} />
            </Field>
            <p className="sm:col-span-3 text-[0.78rem] text-[#8b96ad]">
              Recording money here confirms the booking automatically.
            </p>
          </div>
        </Panel>
      </div>

      <aside className="lg:sticky lg:top-6">
        <Panel title="Summary">
          <div className="px-5 py-4 text-[0.88rem]">
            {trip && price ? (
              <>
                <p className="font-medium text-navy">{trip.title}</p>
                {trip.batchName && <p className="text-[0.8rem] text-[#8b96ad]">{trip.batchName}</p>}

                <dl className="mt-3 border-t border-[#eef1f6] pt-3">
                  <Row label={`${formatINR(toRupees(trip.pricePaise))} × ${seats}`} value={formatINR(toRupees(price.subtotal))} />
                  <Row label={`GST ${trip.gstPercent}%`} value={formatINR(toRupees(price.gst))} />
                  {trip.tcsPercent > 0 && (
                    <Row label={`TCS ${trip.tcsPercent}%`} value={formatINR(toRupees(price.tcs))} />
                  )}
                  <div className="mt-2 flex items-baseline justify-between border-t border-[#eef1f6] pt-2">
                    <dt className="font-medium text-navy">Total</dt>
                    <dd className="font-display text-lg tabular-nums text-navy">
                      {formatINR(toRupees(price.total))}
                    </dd>
                  </div>
                  {trip.advancePaise && (
                    <p className="mt-1.5 text-[0.78rem] text-[#8b96ad]">
                      Advance for {seats}: {formatINR(toRupees(trip.advancePaise * seats))}
                    </p>
                  )}
                </dl>
              </>
            ) : (
              <p className="text-[#8b96ad]">Choose a trip.</p>
            )}

            <button
              type="button"
              onClick={submit}
              disabled={pending || !customerChosen || !trip || trip.seatsAvailable === 0}
              className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-navy px-3.5 py-2.5 text-[0.88rem] font-medium text-cream hover:bg-[#1b2f56] disabled:opacity-50"
            >
              {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {pending ? "Creating…" : "Create booking"}
            </button>
            {!customerChosen && (
              <p className="mt-2 text-center text-[0.78rem] text-[#8b96ad]">
                Pick or create a customer first.
              </p>
            )}
          </div>
        </Panel>
      </aside>
    </div>
  );
}

const control =
  "w-full rounded-lg border border-[#e3e7ee] bg-white px-3 py-[7px] text-[0.86rem] text-[#16203a] outline-none focus:border-teal";

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className ?? ""}`}>
      <span className="mb-1.5 block text-[0.72rem] font-semibold uppercase tracking-[0.09em] text-[#8b96ad]">
        {label}
      </span>
      {children}
    </label>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="mb-1.5 flex items-baseline justify-between gap-3">
      <dt className="text-[#5a6785]">{label}</dt>
      <dd className="tabular-nums text-navy">{value}</dd>
    </div>
  );
}

function SeatBtn({
  onClick,
  disabled,
  label,
  children,
}: {
  onClick: () => void;
  disabled: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="grid h-8 w-8 place-items-center rounded-full border border-[#e3e7ee] bg-white text-navy transition hover:border-navy disabled:cursor-not-allowed disabled:opacity-35"
    >
      {children}
    </button>
  );
}
