"use client";

import { useState } from "react";
import { apiFetch, ApiError } from "@/lib/api-client";
import { ArrowDownToLine, ArrowUpFromLine, Loader2, Wallet } from "lucide-react";

function naira(kobo: number) {
  return `₦${(kobo / 100).toLocaleString("en-NG", { maximumFractionDigits: 2 })}`;
}

export default function WalletActions({ availableKobo }: { availableKobo: number }) {
  const [topup, setTopup] = useState("");
  const [amount, setAmount] = useState(String(Math.max(5000, Math.floor(availableKobo / 100))));
  const [bankName, setBankName] = useState("");
  const [bankCode, setBankCode] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [busy, setBusy] = useState<"topup" | "withdraw" | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function addMoney(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setMessage(""); setBusy("topup");
    try {
      const result = await apiFetch<{ authorizationUrl: string }>("/api/wallet/topup", {
        method: "POST",
        body: JSON.stringify({ amountKobo: Math.round(Number(topup) * 100) }),
      });
      window.location.href = result.authorizationUrl;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not start payment.");
      setBusy(null);
    }
  }

  async function withdraw(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setMessage(""); setBusy("withdraw");
    try {
      await apiFetch("/api/payouts/withdraw", {
        method: "POST",
        body: JSON.stringify({
          amountKobo: Math.round(Number(amount) * 100),
          bankName, bankCode, accountName, accountNumber,
        }),
      });
      setMessage("Withdrawal submitted. Manual processing may take a few minutes. Your dashboard will update after it is processed.");
      setBusy(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not submit withdrawal.");
      setBusy(null);
    }
  }

  return (
    <div className="mt-6 grid lg:grid-cols-2 gap-4">
      <form onSubmit={addMoney} className="rounded-2xl border border-[var(--line)] bg-[var(--paper-raised)] p-5 card-shadow">
        <div className="flex items-center gap-2 font-semibold"><ArrowDownToLine size={17} /> Add money</div>
        <p className="text-xs text-[var(--ink-soft)] mt-1">
          Payment goes to the platform Paystack account. We manually credit your dashboard after confirmation.
        </p>
        <input
          required type="number" min="100" step="0.01" value={topup}
          onChange={e => setTopup(e.target.value)} placeholder="Amount in ₦"
          className="mt-4 w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 text-sm"
        />
        <button disabled={busy !== null} className="mt-3 w-full rounded-xl bg-grad-brand text-white py-2.5 text-sm font-semibold disabled:opacity-50">
          {busy === "topup" ? <Loader2 className="mx-auto animate-spin" size={16} /> : "Pay with Paystack"}
        </button>
      </form>

      <form onSubmit={withdraw} className="rounded-2xl border border-[var(--line)] bg-[var(--paper-raised)] p-5 card-shadow">
        <div className="flex items-center gap-2 font-semibold"><ArrowUpFromLine size={17} /> Withdraw</div>
        <p className="text-xs text-[var(--ink-soft)] mt-1">Available now: <strong>{naira(availableKobo)}</strong>. We send the money manually through Paystack.</p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <input required value={amount} onChange={e => setAmount(e.target.value)} type="number" min="1" step="0.01" placeholder="Amount ₦" className="rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 text-sm" />
          <input required value={bankName} onChange={e => setBankName(e.target.value)} placeholder="Bank name" className="rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 text-sm" />
          <input required value={bankCode} onChange={e => setBankCode(e.target.value)} placeholder="Bank code" className="rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 text-sm" />
          <input required value={accountName} onChange={e => setAccountName(e.target.value)} placeholder="Account name" className="rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 text-sm" />
          <input required value={accountNumber} onChange={e => setAccountNumber(e.target.value)} placeholder="10-digit account number" maxLength={10} className="col-span-2 rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 text-sm" />
        </div>
        <button disabled={busy !== null} className="mt-3 w-full rounded-xl bg-ink text-white py-2.5 text-sm font-semibold disabled:opacity-50">
          {busy === "withdraw" ? <Loader2 className="mx-auto animate-spin" size={16} /> : "Request withdrawal"}
        </button>
      </form>

      {(error || message) && (
        <div className={`lg:col-span-2 rounded-xl px-4 py-3 text-sm ${error ? "bg-rose-50 text-rose-700 border border-rose-200" : "bg-emerald-50 text-emerald-700 border border-emerald-200"}`}>
          {error || message}
        </div>
      )}
    </div>
  );
}
