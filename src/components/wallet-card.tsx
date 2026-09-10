"use client";

import { useState } from "react";
import { Wallet, Plus, ArrowDownToLine, X, Loader2, Info } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api-client";

// A short, common list so people don't have to go look up their bank
// code. Not exhaustive — "Other" lets them type it in directly.
const BANKS: { name: string; code: string }[] = [
  { name: "Access Bank", code: "044" },
  { name: "GTBank", code: "058" },
  { name: "Zenith Bank", code: "057" },
  { name: "First Bank of Nigeria", code: "011" },
  { name: "UBA", code: "033" },
  { name: "Fidelity Bank", code: "070" },
  { name: "Union Bank", code: "032" },
  { name: "Sterling Bank", code: "232" },
  { name: "Wema Bank", code: "035" },
  { name: "Kuda Bank", code: "50211" },
  { name: "Opay", code: "999992" },
  { name: "Palmpay", code: "999991" },
  { name: "Moniepoint", code: "50515" },
];

function naira(kobo: number): string {
  return `₦${(kobo / 100).toLocaleString()}`;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4 py-6" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-2xl bg-[var(--paper-raised)] border border-[var(--line)] p-6 card-shadow"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">{title}</h3>
          <button onClick={onClose} aria-label="Close" className="text-[var(--ink-soft)] hover:text-[var(--ink)]">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ManualProcessingNote() {
  return (
    <p className="flex items-start gap-1.5 text-xs text-[var(--ink-soft)] bg-amber-50 border border-amber-200/60 rounded-lg px-3 py-2 mt-3">
      <Info size={14} className="shrink-0 mt-0.5" />
      This is processed manually for now — it can take a few minutes to show up on your dashboard.
    </p>
  );
}

export default function WalletCard({ balanceKobo }: { balanceKobo: number }) {
  const [modal, setModal] = useState<"none" | "add" | "withdraw">("none");
  const [balance, setBalance] = useState(balanceKobo);

  // --- Add money ---
  const [addAmount, setAddAmount] = useState("");
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  async function submitAdd() {
    setAddError(null);
    const nairaAmount = Number(addAmount);
    if (!nairaAmount || nairaAmount < 100) {
      setAddError("Enter at least ₦100.");
      return;
    }
    setAddLoading(true);
    try {
      const result = await apiFetch<{ authorizationUrl: string }>("/api/wallet/topup/initialize", {
        method: "POST",
        body: JSON.stringify({ amountKobo: Math.round(nairaAmount * 100) }),
      });
      window.location.href = result.authorizationUrl;
    } catch (err) {
      setAddError(err instanceof ApiError ? err.message : "Something went wrong.");
      setAddLoading(false);
    }
  }

  // --- Withdraw ---
  const [wAmount, setWAmount] = useState("");
  const [wBankCode, setWBankCode] = useState(BANKS[0].code);
  const [wBankOther, setWBankOther] = useState("");
  const [wAccountNumber, setWAccountNumber] = useState("");
  const [wAccountName, setWAccountName] = useState("");
  const [wLoading, setWLoading] = useState(false);
  const [wError, setWError] = useState<string | null>(null);
  const [wSuccess, setWSuccess] = useState(false);

  async function submitWithdraw() {
    setWError(null);
    const nairaAmount = Number(wAmount);
    if (!nairaAmount || nairaAmount <= 0) {
      setWError("Enter a valid amount.");
      return;
    }
    if (Math.round(nairaAmount * 100) > balance) {
      setWError(`You only have ₦${(balance / 100).toLocaleString()} available.`);
      return;
    }
    const bankIsOther = wBankCode === "OTHER";
    if (bankIsOther && !wBankOther.trim()) {
      setWError("Enter your bank name.");
      return;
    }
    if (wAccountNumber.trim().length < 6) {
      setWError("Enter a valid account number.");
      return;
    }
    if (!wAccountName.trim()) {
      setWError("Enter the account name.");
      return;
    }
    setWLoading(true);
    try {
      const bankName = bankIsOther ? wBankOther.trim() : BANKS.find((b) => b.code === wBankCode)?.name ?? wBankCode;
      await apiFetch("/api/wallet/withdraw", {
        method: "POST",
        body: JSON.stringify({
          amountKobo: Math.round(nairaAmount * 100),
          bankCode: bankIsOther ? "OTHER" : wBankCode,
          bankName,
          accountNumber: wAccountNumber.trim(),
          accountName: wAccountName.trim(),
        }),
      });
      setBalance((b) => b - Math.round(nairaAmount * 100));
      setWSuccess(true);
    } catch (err) {
      setWError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setWLoading(false);
    }
  }

  return (
    <>
      <div className="rounded-2xl border border-[var(--line)] bg-[var(--paper-raised)] p-5 card-shadow">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-violet-100 text-violet-700 flex items-center justify-center shrink-0">
              <Wallet size={17} />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-[var(--ink-soft)] font-mono">Wallet balance</p>
              <p className="text-2xl font-mono font-semibold">{naira(balance)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setModal("add")}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-grad-warm text-white text-sm font-medium hover:opacity-90"
            >
              <Plus size={15} /> Add money
            </button>
            <button
              type="button"
              onClick={() => {
                setWSuccess(false);
                setModal("withdraw");
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-[var(--line)] text-sm font-medium hover:bg-black/[0.03]"
            >
              <ArrowDownToLine size={15} /> Withdraw
            </button>
          </div>
        </div>
      </div>

      {modal === "add" && (
        <Modal title="Add money to your wallet" onClose={() => setModal("none")}>
          <p className="text-sm text-[var(--ink-soft)] mb-3">
            You&apos;ll be taken to Paystack to pay. Once we confirm it, we&apos;ll credit your wallet.
          </p>
          <label className="block text-sm mb-1 font-medium">Amount (₦)</label>
          <input
            type="number"
            min={100}
            value={addAmount}
            onChange={(e) => setAddAmount(e.target.value)}
            placeholder="5000"
            className="w-full rounded-lg border border-[var(--line)] px-3 py-2 text-sm"
          />
          {addError && <p className="text-sm text-rust mt-2">{addError}</p>}
          <ManualProcessingNote />
          <button
            type="button"
            disabled={addLoading}
            onClick={submitAdd}
            className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-lg bg-grad-warm text-white font-medium py-2.5 disabled:opacity-60"
          >
            {addLoading ? <Loader2 size={16} className="animate-spin" /> : null}
            Continue to Paystack
          </button>
        </Modal>
      )}

      {modal === "withdraw" && (
        <Modal title="Withdraw from wallet" onClose={() => setModal("none")}>
          {wSuccess ? (
            <div>
              <p className="text-sm">Your withdrawal request has been received.</p>
              <ManualProcessingNote />
              <button
                type="button"
                onClick={() => setModal("none")}
                className="mt-4 w-full rounded-lg border border-[var(--line)] py-2.5 text-sm font-medium hover:bg-black/[0.03]"
              >
                Done
              </button>
            </div>
          ) : (
            <>
              <p className="text-sm text-[var(--ink-soft)] mb-3">
                Available: <span className="font-medium">{naira(balance)}</span>
              </p>
              <label className="block text-sm mb-1 font-medium">Amount (₦)</label>
              <input
                type="number"
                min={1}
                value={wAmount}
                onChange={(e) => setWAmount(e.target.value)}
                className="w-full rounded-lg border border-[var(--line)] px-3 py-2 text-sm mb-3"
              />
              <label className="block text-sm mb-1 font-medium">Bank</label>
              <select
                value={wBankCode}
                onChange={(e) => setWBankCode(e.target.value)}
                className="w-full rounded-lg border border-[var(--line)] px-3 py-2 text-sm mb-3 bg-white"
              >
                {BANKS.map((b) => (
                  <option key={b.code} value={b.code}>
                    {b.name}
                  </option>
                ))}
                <option value="OTHER">Other…</option>
              </select>
              {wBankCode === "OTHER" && (
                <input
                  type="text"
                  value={wBankOther}
                  onChange={(e) => setWBankOther(e.target.value)}
                  placeholder="Bank name"
                  className="w-full rounded-lg border border-[var(--line)] px-3 py-2 text-sm mb-3"
                />
              )}
              <label className="block text-sm mb-1 font-medium">Account number</label>
              <input
                type="text"
                inputMode="numeric"
                value={wAccountNumber}
                onChange={(e) => setWAccountNumber(e.target.value)}
                className="w-full rounded-lg border border-[var(--line)] px-3 py-2 text-sm mb-3"
              />
              <label className="block text-sm mb-1 font-medium">Account name</label>
              <input
                type="text"
                value={wAccountName}
                onChange={(e) => setWAccountName(e.target.value)}
                className="w-full rounded-lg border border-[var(--line)] px-3 py-2 text-sm"
              />
              {wError && <p className="text-sm text-rust mt-2">{wError}</p>}
              <ManualProcessingNote />
              <button
                type="button"
                disabled={wLoading}
                onClick={submitWithdraw}
                className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-lg bg-ink text-paper font-medium py-2.5 disabled:opacity-60"
              >
                {wLoading ? <Loader2 size={16} className="animate-spin" /> : null}
                Request withdrawal
              </button>
            </>
          )}
        </Modal>
      )}
    </>
  );
}
