"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, ApiError } from "@/lib/api-client";
import { Loader2, Wallet } from "lucide-react";

export default function WithdrawForm({ availableKobo }: { availableKobo: number }) {
  const router = useRouter();
  const [amountNaira, setAmountNaira] = useState(String(availableKobo / 100));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await apiFetch("/api/payouts/withdraw", {
        method: "POST",
        body: JSON.stringify({ amountKobo: Math.round(Number(amountNaira) * 100) }),
      });
      setDone(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
        Withdrawal requested — it&apos;ll move to your linked bank account once processed.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-center gap-2">
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--ink-soft)]">₦</span>
        <input
          type="number"
          min={1}
          max={availableKobo / 100}
          step="0.01"
          value={amountNaira}
          onChange={(e) => setAmountNaira(e.target.value)}
          className="rounded-lg border border-[var(--line)] bg-white pl-7 pr-3 py-2 text-sm w-36 focus:border-brass focus:ring-2 focus:ring-brass/20 outline-none"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-lg bg-grad-brand text-white hover:opacity-90 disabled:opacity-50"
      >
        {loading ? <Loader2 size={14} className="animate-spin" /> : <Wallet size={14} />}
        Withdraw
      </button>
      {error && <p className="w-full text-sm text-rust">{error}</p>}
    </form>
  );
}
