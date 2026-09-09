"use client";

import { useState, FormEvent } from "react";
import { Settings2, Loader2, CheckCircle2 } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api-client";

export default function SettingsEditor({
  payoutHoldDays,
  minWithdrawalKobo,
}: {
  payoutHoldDays: number;
  minWithdrawalKobo: number;
}) {
  const [holdDays, setHoldDays] = useState(String(payoutHoldDays));
  const [minWithdrawal, setMinWithdrawal] = useState(String(minWithdrawalKobo / 100));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setLoading(true);
    try {
      await apiFetch("/api/admin/settings", {
        method: "PATCH",
        body: JSON.stringify({
          payoutHoldDays: parseInt(holdDays, 10),
          minWithdrawalKobo: Math.round(parseFloat(minWithdrawal) * 100),
        }),
      });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-6 space-y-5">
      <h2 className="text-sm font-semibold flex items-center gap-2">
        <Settings2 size={15} className="text-brass" /> Payouts & withdrawals
      </h2>
      {error && <p className="text-sm text-rust bg-rust/10 border border-rust/30 rounded-lg px-3 py-2">{error}</p>}
      {success && (
        <p className="flex items-center gap-2 text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-2">
          <CheckCircle2 size={15} /> Settings saved.
        </p>
      )}

      <label className="block">
        <span className="text-xs font-medium text-white/60 mb-1.5 block">Payout hold window (days)</span>
        <input
          type="number"
          min="0"
          max="60"
          value={holdDays}
          onChange={(e) => setHoldDays(e.target.value)}
          className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm outline-none focus:border-brass"
        />
        <span className="text-xs text-white/40 mt-1 block">
          How long after checkout before a provider&apos;s earnings become available to withdraw.
        </span>
      </label>

      <label className="block">
        <span className="text-xs font-medium text-white/60 mb-1.5 block">Minimum withdrawal (₦)</span>
        <input
          type="number"
          min="0"
          step="0.01"
          value={minWithdrawal}
          onChange={(e) => setMinWithdrawal(e.target.value)}
          className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm outline-none focus:border-brass"
        />
      </label>

      <button
        type="submit"
        disabled={loading}
        className="flex items-center gap-2 rounded-xl bg-grad-brand px-4 py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        {loading && <Loader2 size={14} className="animate-spin" />}
        Save settings
      </button>
    </form>
  );
}
