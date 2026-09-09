"use client";

import { useState, FormEvent } from "react";
import { Percent, Loader2, CheckCircle2 } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api-client";

export default function CommissionEditor({ currentBps }: { currentBps: number }) {
  const [value, setValue] = useState((currentBps / 100).toString());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    const pct = parseFloat(value);
    if (isNaN(pct) || pct < 0 || pct > 100) {
      setError("Enter a percentage between 0 and 100.");
      return;
    }
    setLoading(true);
    try {
      await apiFetch("/api/admin/commission", {
        method: "PATCH",
        body: JSON.stringify({ platformCommissionBps: Math.round(pct * 100) }),
      });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-6 space-y-4">
      <h2 className="text-sm font-semibold flex items-center gap-2">
        <Percent size={15} className="text-brass" /> Default platform commission
      </h2>
      {error && <p className="text-sm text-rust bg-rust/10 border border-rust/30 rounded-lg px-3 py-2">{error}</p>}
      {success && (
        <p className="flex items-center gap-2 text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-2">
          <CheckCircle2 size={15} /> Commission rate updated. New bookings will use this rate.
        </p>
      )}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 flex-1">
          <input
            type="number"
            min="0"
            max="100"
            step="0.1"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="bg-transparent outline-none w-full text-sm"
          />
          <span className="text-white/40 text-sm">%</span>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="flex items-center gap-2 rounded-xl bg-grad-brand px-4 py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {loading && <Loader2 size={14} className="animate-spin" />}
          Save
        </button>
      </div>
      <p className="text-xs text-white/40">
        Applies to every new booking that doesn&apos;t have a provider-specific override.
      </p>
    </form>
  );
}
