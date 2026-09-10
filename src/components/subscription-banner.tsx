"use client";

import { useState } from "react";
import Link from "next/link";
import { Sparkles, Loader2 } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api-client";

interface Subscription {
  tier: "STARTER" | "ETERNAL" | "PRO";
  status: "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELLED";
  trialEndsAt: string | null;
}

const TIER_LABEL: Record<Subscription["tier"], string> = {
  STARTER: "Starter",
  ETERNAL: "Eternal",
  PRO: "Pro",
};

export default function SubscriptionBanner({ subscription }: { subscription: Subscription | null }) {
  const [current, setCurrent] = useState(subscription);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!current || current.status === "CANCELLED") {
    return (
      <div className="mt-4 rounded-2xl border border-dashed border-brass/40 bg-gradient-to-r from-violet-50 to-orange-50 p-5 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-grad-warm text-white flex items-center justify-center shrink-0">
            <Sparkles size={18} />
          </div>
          <div>
            <p className="font-medium">Choose a plan to unlock your account</p>
            <p className="text-sm text-[var(--ink-soft)]">Starter includes a 7-day free trial.</p>
          </div>
        </div>
        <Link
          href="/packages"
          className="shrink-0 px-4 py-2 rounded-lg bg-ink text-paper text-sm font-medium hover:bg-[var(--ink-soft)]"
        >
          View plans
        </Link>
      </div>
    );
  }

  async function cancel() {
    if (!confirm("Cancel your plan? Your card won't be charged again.")) return;
    setCancelling(true);
    setError(null);
    try {
      await apiFetch("/api/subscriptions/cancel", { method: "POST" });
      setCurrent((c) => (c ? { ...c, status: "CANCELLED" } : c));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setCancelling(false);
    }
  }

  const trialEndsLabel =
    current.status === "TRIALING" && current.trialEndsAt
      ? new Date(current.trialEndsAt).toLocaleDateString()
      : null;

  return (
    <div className="mt-4 rounded-2xl border border-[var(--line)] bg-[var(--paper-raised)] p-5 flex items-center justify-between gap-4 flex-wrap">
      <div>
        <p className="font-medium">
          {TIER_LABEL[current.tier]} plan{" "}
          <span
            className={`ml-1 text-xs font-medium px-2 py-0.5 rounded-full ${
              current.status === "TRIALING" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
            }`}
          >
            {current.status === "TRIALING" ? "Free trial" : "Active"}
          </span>
        </p>
        <p className="text-sm text-[var(--ink-soft)] mt-0.5">
          {trialEndsLabel
            ? `Your card will be charged automatically on ${trialEndsLabel}. You can cancel any time before then.`
            : "Billed automatically. You can cancel any time."}
        </p>
        {error && <p className="text-sm text-rust mt-1">{error}</p>}
      </div>
      <button
        type="button"
        onClick={cancel}
        disabled={cancelling}
        className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-[var(--line)] text-sm font-medium hover:bg-black/[0.03] disabled:opacity-60"
      >
        {cancelling ? <Loader2 size={14} className="animate-spin" /> : null}
        Cancel plan
      </button>
    </div>
  );
}
