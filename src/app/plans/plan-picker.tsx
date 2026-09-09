"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, ApiError } from "@/lib/api-client";
import { Check, Loader2, ShieldCheck, Sparkles, Crown } from "lucide-react";

const plans = [
  { tier: "STARTER" as const, name: "Starter", icon: Sparkles, highlight: "7 days free", copy: "Try the full marketplace for 7 days. A card is required so recurring billing can begin after the trial.", bullets: ["7-day free trial", "Card required", "Cancel anytime"] },
  { tier: "ETERNAL" as const, name: "Eternal", icon: ShieldCheck, highlight: "Recurring", copy: "For people who want ongoing access to the marketplace tools and network.", bullets: ["Recurring billing", "Provider + renter access", "Priority account tools"] },
  { tier: "PRO" as const, name: "Pro", icon: Crown, highlight: "Advanced", copy: "For serious providers and high-volume users who want the advanced plan.", bullets: ["Recurring billing", "Advanced marketplace tools", "Priority support"] },
];

export default function PlanPicker({ email }: { email: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function choose(tier: string) {
    setBusy(tier); setError("");
    try {
      const result = await apiFetch<{ authorizationUrl: string }>("/api/subscriptions/initialize", {
        method: "POST", body: JSON.stringify({ tier }),
      });
      window.location.href = result.authorizationUrl;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not start plan checkout.");
      setBusy(null);
    }
  }

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-gradient-to-br from-violet-50 via-white to-orange-50 px-5 py-12">
      <div className="mx-auto max-w-6xl">
        <div className="text-center max-w-2xl mx-auto">
          <p className="text-sm font-medium text-brass">Welcome to Access</p>
          <h1 className="mt-2 text-3xl sm:text-5xl font-semibold tracking-tight">Choose your membership</h1>
          <p className="mt-3 text-[var(--ink-soft)]">You must choose a plan before entering your dashboard. Checkout is handled securely by Paystack for {email}.</p>
        </div>
        {error && <div className="max-w-2xl mx-auto mt-6 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 text-sm">{error}</div>}
        <div className="mt-10 grid md:grid-cols-3 gap-5">
          {plans.map(p => (
            <div key={p.tier} className={`rounded-3xl border bg-white p-6 card-shadow ${p.tier === "STARTER" ? "border-brass ring-2 ring-brass/10" : "border-[var(--line)]"}`}>
              <p className="text-xs uppercase tracking-widest text-[var(--ink-soft)]">{p.highlight}</p>
              <div className="mt-3 flex items-center gap-2"><p.icon size={20} className="text-brass"/><h2 className="text-2xl font-semibold">{p.name}</h2></div>
              <p className="mt-3 text-sm text-[var(--ink-soft)] min-h-16">{p.copy}</p>
              <ul className="mt-5 space-y-2 text-sm">{p.bullets.map(b => <li key={b} className="flex gap-2"><Check size={16} className="text-emerald-600 shrink-0"/>{b}</li>)}</ul>
              <button onClick={() => choose(p.tier)} disabled={busy !== null} className="mt-7 w-full rounded-xl bg-grad-brand text-white py-3 text-sm font-semibold disabled:opacity-50">
                {busy === p.tier ? <Loader2 className="mx-auto animate-spin" size={17}/> : p.tier === "STARTER" ? "Start 7-day trial" : `Choose ${p.name}`}
              </button>
              {p.tier === "STARTER" && <p className="mt-3 text-[11px] text-center text-[var(--ink-soft)]">Paystack currently requires a small card-verification charge for this implementation; it is refunded after successful authorization. The subscription starts after 7 days.</p>}
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
