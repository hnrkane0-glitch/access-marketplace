"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

/**
 * Paystack redirects here after checkout. This page does NOT mark the
 * booking as paid — it has no authority to. It polls GET /api/bookings/:id
 * until the webhook (the only real source of truth) has moved the
 * booking past PAYMENT_PENDING. See ARCHITECTURE.md §2.
 */
export default function ConfirmingPaymentPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [attempts, setAttempts] = useState(0);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(`/api/bookings/${params.id}`, { credentials: "include" });
        const data = await res.json();
        if (cancelled) return;

        if (data.status && data.status !== "PAYMENT_PENDING") {
          router.replace(`/bookings/${params.id}`);
          return;
        }
      } catch {
        // transient network error — keep polling
      }

      if (!cancelled) {
        setAttempts((n) => n + 1);
      }
    }

    if (attempts >= 20) {
      setTimedOut(true);
      return;
    }

    const t = setTimeout(poll, 3000);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [attempts, params.id, router]);

  return (
    <div className="mx-auto max-w-sm px-5 py-24 text-center">
      {!timedOut ? (
        <>
          <div className="mx-auto w-10 h-10 rounded-full border-2 border-brass border-t-transparent animate-spin" />
          <p className="mt-6 font-medium">Confirming your payment…</p>
          <p className="mt-1 text-sm text-[var(--ink-soft)]">
            This usually takes a few seconds. Don&apos;t close this page.
          </p>
        </>
      ) : (
        <>
          <p className="font-medium">This is taking longer than expected.</p>
          <p className="mt-1 text-sm text-[var(--ink-soft)]">
            Your payment may still be processing. Check your booking status in a moment —
            you won&apos;t be charged twice.
          </p>
        </>
      )}
    </div>
  );
}
