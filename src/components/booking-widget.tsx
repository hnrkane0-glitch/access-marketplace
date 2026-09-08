"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, ApiError } from "@/lib/api-client";

interface Props {
  listingId: string;
  isLoggedIn: boolean;
  minBookingMinutes: number;
}

function toLocalDatetimeInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}`;
}

export default function BookingWidget({ listingId, isLoggedIn, minBookingMinutes }: Props) {
  const router = useRouter();
  const now = new Date();
  const defaultStart = new Date(now.getTime() + 60 * 60 * 1000);
  const defaultEnd = new Date(defaultStart.getTime() + minBookingMinutes * 60 * 1000);

  const [startsAt, setStartsAt] = useState(toLocalDatetimeInputValue(defaultStart));
  const [endsAt, setEndsAt] = useState(toLocalDatetimeInputValue(defaultEnd));
  const [quote, setQuote] = useState<{
    id: string;
    bookingAmountKobo: number;
    depositAmountKobo: number;
    totalAmountKobo: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function requestBooking() {
    if (!isLoggedIn) {
      router.push("/login");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const result = await apiFetch<{
        id: string;
        bookingAmountKobo: number;
        depositAmountKobo: number;
        totalAmountKobo: number;
      }>("/api/bookings", {
        method: "POST",
        body: JSON.stringify({
          listingId,
          startsAt: new Date(startsAt).toISOString(),
          endsAt: new Date(endsAt).toISOString(),
          quantity: 1,
        }),
      });
      setQuote(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function proceedToPayment() {
    if (!quote) return;
    setLoading(true);
    setError(null);
    try {
      const result = await apiFetch<{ authorizationUrl: string }>(
        "/api/payments/paystack/initialize",
        {
          method: "POST",
          body: JSON.stringify({ bookingId: quote.id }),
        }
      );
      window.location.href = result.authorizationUrl;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-[var(--line)] p-5 bg-[var(--paper-raised)] sticky top-24">
      {!quote ? (
        <>
          <div className="space-y-3">
            <label className="block text-sm">
              <span className="block font-medium mb-1">Starts</span>
              <input
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className="w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-sm">
              <span className="block font-medium mb-1">Ends</span>
              <input
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                className="w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm"
              />
            </label>
          </div>

          {error && (
            <p className="mt-3 text-sm text-rust bg-rust/10 border border-rust/30 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            onClick={requestBooking}
            disabled={loading}
            className="mt-4 w-full rounded-lg bg-ink text-paper font-medium py-2.5 hover:bg-[var(--ink-soft)] disabled:opacity-50"
          >
            {loading ? "Checking price…" : "Check price & availability"}
          </button>
          <p className="mt-2 text-xs text-[var(--ink-soft)]">
            Price is calculated by the server once you continue — nothing is charged yet.
          </p>
        </>
      ) : (
        <>
          <p className="text-xs uppercase tracking-wide text-[var(--ink-soft)] font-mono">
            Price breakdown
          </p>
          <dl className="mt-3 space-y-1.5 text-sm">
            <div className="flex justify-between">
              <dt>Booking amount</dt>
              <dd className="font-mono">₦{(quote.bookingAmountKobo / 100).toLocaleString()}</dd>
            </div>
            {quote.depositAmountKobo > 0 && (
              <div className="flex justify-between">
                <dt>Security deposit (refundable)</dt>
                <dd className="font-mono">₦{(quote.depositAmountKobo / 100).toLocaleString()}</dd>
              </div>
            )}
            <div className="flex justify-between pt-2 border-t border-[var(--line)] font-medium">
              <dt>Total due now</dt>
              <dd className="font-mono">₦{(quote.totalAmountKobo / 100).toLocaleString()}</dd>
            </div>
          </dl>

          {error && (
            <p className="mt-3 text-sm text-rust bg-rust/10 border border-rust/30 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            onClick={proceedToPayment}
            disabled={loading}
            className="mt-4 w-full rounded-lg bg-brass text-white font-medium py-2.5 hover:bg-[var(--brass-dim)] disabled:opacity-50"
          >
            {loading ? "Starting payment…" : "Pay securely with Paystack"}
          </button>
          <button
            onClick={() => setQuote(null)}
            className="mt-2 w-full text-sm text-[var(--ink-soft)] hover:underline"
          >
            Change dates
          </button>
        </>
      )}
    </div>
  );
}
