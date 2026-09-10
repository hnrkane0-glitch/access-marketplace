"use client";

import { useState } from "react";
import { Check, Loader2, Zap, Crown, Infinity as InfinityIcon } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api-client";
import { TIER_LABELS, type PackageTier } from "@/lib/subscription-plans";

interface Plan {
  tier: PackageTier;
  priceLabel: string;
  interval: string;
  available: boolean;
}

const TIER_ICON: Record<PackageTier, typeof Zap> = {
  STARTER: Zap,
  ETERNAL: InfinityIcon,
  PRO: Crown,
};

const TIER_PERKS: Record<PackageTier, string[]> = {
  STARTER: ["7 days free, card required", "Full access to all features", "Cancel any time before trial ends"],
  ETERNAL: ["Everything in Starter", "No trial — billed straight away", "Priority support"],
  PRO: ["Everything in Eternal", "Advanced tools for high-volume providers", "Dedicated support"],
};

export default function PackagePicker({ plans }: { plans: Plan[] }) {
  const [loadingTier, setLoadingTier] = useState<PackageTier | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function choose(tier: PackageTier) {
    setError(null);
    setLoadingTier(tier);
    try {
      const result = await apiFetch<{ authorizationUrl: string }>("/api/subscriptions/start", {
        method: "POST",
        body: JSON.stringify({ tier }),
      });
      window.location.href = result.authorizationUrl;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
      setLoadingTier(null);
    }
  }

  return (
    <div className="mt-10">
      {error && (
        <p className="max-w-md mx-auto mb-6 text-sm text-rust bg-rust/10 border border-rust/30 rounded-lg px-3 py-2 text-center">
          {error}
        </p>
      )}
      <div className="grid sm:grid-cols-3 gap-5">
        {plans.map((plan) => {
          const Icon = TIER_ICON[plan.tier];
          const featured = plan.tier === "ETERNAL";
          return (
            <div
              key={plan.tier}
              className={`rounded-2xl border p-6 flex flex-col card-shadow ${
                featured
                  ? "border-brass bg-[var(--paper-raised)] ring-1 ring-brass"
                  : "border-[var(--line)] bg-[var(--paper-raised)]"
              }`}
            >
              <div className="w-10 h-10 rounded-xl bg-grad-warm text-white flex items-center justify-center">
                <Icon size={18} />
              </div>
              <h3 className="mt-4 text-lg font-semibold">{TIER_LABELS[plan.tier]}</h3>
              <p className="mt-1 text-2xl font-mono font-semibold">
                {plan.priceLabel}
                <span className="text-sm font-normal text-[var(--ink-soft)]">/{plan.interval}</span>
              </p>
              {plan.tier === "STARTER" && (
                <p className="mt-1 text-xs font-medium text-emerald-700">7 days free, then billed automatically</p>
              )}
              <ul className="mt-4 space-y-2 flex-1">
                {TIER_PERKS[plan.tier].map((perk) => (
                  <li key={perk} className="flex items-start gap-2 text-sm text-[var(--ink-soft)]">
                    <Check size={15} className="text-emerald-600 mt-0.5 shrink-0" />
                    {perk}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                disabled={!plan.available || loadingTier !== null}
                onClick={() => choose(plan.tier)}
                className={`mt-6 w-full inline-flex items-center justify-center gap-2 rounded-full py-2.5 font-medium disabled:opacity-60 ${
                  featured ? "bg-grad-warm text-white hover:opacity-90" : "bg-ink text-paper hover:opacity-90"
                }`}
              >
                {loadingTier === plan.tier ? <Loader2 size={16} className="animate-spin" /> : null}
                {plan.tier === "STARTER" ? "Start free trial" : `Choose ${TIER_LABELS[plan.tier]}`}
              </button>
            </div>
          );
        })}
      </div>
      <p className="mt-6 text-center text-xs text-[var(--ink-soft)]">
        A card is required for every plan, including the Starter trial. You&apos;ll be taken to
        Paystack to add it securely — we never see or store your card details.
      </p>
    </div>
  );
}
