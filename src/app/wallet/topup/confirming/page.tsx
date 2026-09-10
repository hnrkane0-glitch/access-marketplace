"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

export default function ConfirmingTopUpPage() {
  return (
    <Suspense fallback={null}>
      <ConfirmingTopUpInner />
    </Suspense>
  );
}

function ConfirmingTopUpInner() {
  const searchParams = useSearchParams();
  const reference = searchParams.get("reference") ?? searchParams.get("trxref");
  const [status, setStatus] = useState<"loading" | "success" | "pending" | "error">("loading");
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    if (!reference) {
      setStatus("error");
      return;
    }
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(`/api/wallet/topup/status?reference=${encodeURIComponent(reference!)}`, {
          credentials: "include",
        });
        const data = await res.json();
        if (cancelled) return;

        if (data.status === "SUCCESS") {
          setStatus("success");
          return;
        }
        if (data.status === "FAILED" || data.status === "ABANDONED") {
          setStatus("error");
          return;
        }
      } catch {
        // transient — keep polling
      }
      if (!cancelled) setAttempts((n) => n + 1);
    }

    if (attempts >= 15) {
      setStatus("pending");
      return;
    }

    const t = setTimeout(poll, 2000);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [attempts, reference]);

  return (
    <div className="mx-auto max-w-sm px-5 py-24 text-center">
      {status === "loading" && (
        <>
          <div className="mx-auto w-10 h-10 rounded-full border-2 border-brass border-t-transparent animate-spin" />
          <p className="mt-6 font-medium">Confirming your payment…</p>
          <p className="mt-1 text-sm text-[var(--ink-soft)]">Don&apos;t close this page.</p>
        </>
      )}
      {(status === "success" || status === "pending") && (
        <>
          <CheckCircle2 size={36} className="mx-auto text-emerald-600" />
          <p className="mt-4 font-medium">
            {status === "success" ? "Payment received." : "Payment is on its way."}
          </p>
          <p className="mt-1 text-sm text-[var(--ink-soft)]">
            We top up wallets manually for now, so it can take a few minutes for the balance to
            show up on your dashboard. You&apos;ll get a notification once it&apos;s credited.
          </p>
          <Link
            href="/dashboard"
            className="mt-6 inline-block rounded-full bg-ink text-paper text-sm font-medium px-5 py-2.5 hover:opacity-90"
          >
            Back to dashboard
          </Link>
        </>
      )}
      {status === "error" && (
        <>
          <p className="font-medium">We couldn&apos;t confirm this payment.</p>
          <p className="mt-1 text-sm text-[var(--ink-soft)]">
            If you were charged, it will still be picked up — check back shortly, or contact
            support with your payment reference.
          </p>
          <Link
            href="/dashboard"
            className="mt-6 inline-block rounded-full bg-ink text-paper text-sm font-medium px-5 py-2.5 hover:opacity-90"
          >
            Back to dashboard
          </Link>
        </>
      )}
    </div>
  );
}
