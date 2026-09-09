"use client";

import { useState } from "react";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api-client";

interface Row {
  id: string;
  name: string;
  email: string;
  amountKobo: number;
  bankCode: string;
  accountNumber: string;
  requestedAt: string;
  status: string;
}

function naira(kobo: number): string {
  return `₦${(kobo / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export default function WithdrawalTable({ rows: initialRows }: { rows: Row[] }) {
  const [rows, setRows] = useState(initialRows);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(id: string, action: "complete" | "fail") {
    setBusyId(id);
    setError(null);
    try {
      await apiFetch(`/api/admin/withdrawals/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          action,
          failureReason: action === "fail" ? "Rejected by admin" : undefined,
        }),
      });
      setRows((cur) => cur.filter((r) => r.id !== id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mt-6">
      {error && (
        <p className="mb-3 text-sm text-rust bg-rust/10 border border-rust/30 rounded-lg px-3 py-2">{error}</p>
      )}
      <div className="rounded-2xl border border-white/10 bg-white/5 overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr className="text-left text-xs text-white/40 uppercase tracking-wide border-b border-white/10">
              <th className="px-4 py-3 font-medium">Requested by</th>
              <th className="px-4 py-3 font-medium">Amount</th>
              <th className="px-4 py-3 font-medium">Bank details</th>
              <th className="px-4 py-3 font-medium">Requested</th>
              <th className="px-4 py-3 font-medium text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-white/5 last:border-0">
                <td className="px-4 py-3">
                  <p className="font-medium">{r.name}</p>
                  <p className="text-xs text-white/40">{r.email}</p>
                </td>
                <td className="px-4 py-3 font-medium">{naira(r.amountKobo)}</td>
                <td className="px-4 py-3 text-xs text-white/50">
                  {r.bankCode} &middot; {r.accountNumber}
                </td>
                <td className="px-4 py-3 text-xs text-white/40">{new Date(r.requestedAt).toLocaleString()}</td>
                <td className="px-4 py-3 text-right space-x-1.5 whitespace-nowrap">
                  <button
                    type="button"
                    disabled={busyId === r.id}
                    onClick={() => act(r.id, "complete")}
                    className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-emerald-600 disabled:opacity-50 hover:opacity-90"
                  >
                    {busyId === r.id ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                    Mark sent
                  </button>
                  <button
                    type="button"
                    disabled={busyId === r.id}
                    onClick={() => act(r.id, "fail")}
                    className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-white/15 hover:border-rust hover:text-rust disabled:opacity-50"
                  >
                    <XCircle size={13} /> Fail & refund
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-white/40">
                  No pending withdrawal requests.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
