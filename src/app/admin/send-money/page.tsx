"use client";

import { useState, FormEvent } from "react";
import { Send, Loader2, ArrowUpCircle, ArrowDownCircle, CheckCircle2 } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api-client";

export default function AdminSendMoneyPage() {
  const [email, setEmail] = useState("");
  const [amount, setAmount] = useState("");
  const [direction, setDirection] = useState<"CREDIT" | "DEBIT">("CREDIT");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const amountKobo = Math.round(parseFloat(amount) * 100);
    if (!amountKobo || amountKobo <= 0) {
      setError("Enter a valid amount.");
      return;
    }
    setLoading(true);
    try {
      await apiFetch("/api/admin/send-money", {
        method: "POST",
        body: JSON.stringify({ email, amountKobo, direction, note: note || undefined }),
      });
      setSuccess(
        `${direction === "CREDIT" ? "Sent" : "Deducted"} ₦${parseFloat(amount).toLocaleString()} ${
          direction === "CREDIT" ? "to" : "from"
        } ${email}.`
      );
      setEmail("");
      setAmount("");
      setNote("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-semibold tracking-tight">Send money</h1>
      <p className="mt-1 text-sm text-white/50">
        Manually credit or debit any user&apos;s ledger — refunds, goodwill credits, or corrections. Every action is written to the audit log and posted as an immutable ledger entry.
      </p>

      <form onSubmit={onSubmit} className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-6 space-y-4">
        {error && (
          <p className="text-sm text-rust bg-rust/10 border border-rust/30 rounded-lg px-3 py-2">{error}</p>
        )}
        {success && (
          <p className="flex items-center gap-2 text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-2">
            <CheckCircle2 size={15} /> {success}
          </p>
        )}

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setDirection("CREDIT")}
            className={`flex items-center justify-center gap-1.5 rounded-xl border py-2.5 text-sm font-medium transition-colors ${
              direction === "CREDIT" ? "border-emerald-500 bg-emerald-500/10 text-emerald-400" : "border-white/10 text-white/50"
            }`}
          >
            <ArrowUpCircle size={15} /> Credit (send)
          </button>
          <button
            type="button"
            onClick={() => setDirection("DEBIT")}
            className={`flex items-center justify-center gap-1.5 rounded-xl border py-2.5 text-sm font-medium transition-colors ${
              direction === "DEBIT" ? "border-rust bg-rust/10 text-rust" : "border-white/10 text-white/50"
            }`}
          >
            <ArrowDownCircle size={15} /> Debit (deduct)
          </button>
        </div>

        <label className="block">
          <span className="text-xs font-medium text-white/60 mb-1.5 block">User email</span>
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="renter@example.com"
            className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm outline-none focus:border-brass placeholder:text-white/30"
          />
        </label>

        <label className="block">
          <span className="text-xs font-medium text-white/60 mb-1.5 block">Amount (₦)</span>
          <input
            required
            type="number"
            min="1"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="5000"
            className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm outline-none focus:border-brass placeholder:text-white/30"
          />
        </label>

        <label className="block">
          <span className="text-xs font-medium text-white/60 mb-1.5 block">Note (optional, shown to user)</span>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Goodwill credit for booking delay"
            className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm outline-none focus:border-brass placeholder:text-white/30"
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-grad-brand py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 pop-shadow"
        >
          {loading ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
          {direction === "CREDIT" ? "Send money" : "Deduct money"}
        </button>
      </form>
    </div>
  );
}
