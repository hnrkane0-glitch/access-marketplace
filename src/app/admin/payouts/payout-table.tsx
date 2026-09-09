"use client";

import { useState } from "react";
import { PlayCircle, PauseCircle, Loader2, XCircle } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api-client";

interface Row {
  id: string;
  bookingId: string;
  listingTitle: string;
  providerName: string;
  providerEmail: string;
  amountKobo: number;
  availableAt: string;
  holdReason: string | null;
}

function naira(kobo: number): string {
  return `₦${(kobo / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export default function PayoutTable({ rows: initialRows }: { rows: Row[] }) {
  const [rows, setRows] = useState(initialRows);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(id: string, action: "release" | "hold" | "unhold") {
    setBusyId(id);
    setError(null);
    try {
      await apiFetch(`/api/admin/payouts/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ action, reason: action === "hold" ? "Manual admin hold" : "Manual admin release" }),
      });
      if (action === "release") {
        setRows((cur) => cur.filter((r) => r.id !== id));
      } else {
        setRows((cur) =>
          cur.map((r) => (r.id === id ? { ...r, holdReason: action === "hold" ? "ADMIN_HOLD" : null } : r))
        );
      }
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
              <th className="px-4 py-3 font-medium">Listing</th>
              <th className="px-4 py-3 font-medium">Provider</th>
              <th className="px-4 py-3 font-medium">Amount</th>
              <th className="px-4 py-3 font-medium">Available at</th>
              <th className="px-4 py-3 font-medium">Hold</th>
              <th className="px-4 py-3 font-medium text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-white/5 last:border-0">
                <td className="px-4 py-3 max-w-[220px] truncate">{r.listingTitle}</td>
                <td className="px-4 py-3">
                  <p className="font-medium">{r.providerName}</p>
                  <p className="text-xs text-white/40">{r.providerEmail}</p>
                </td>
                <td className="px-4 py-3 font-medium">{naira(r.amountKobo)}</td>
                <td className="px-4 py-3 text-xs text-white/50">{new Date(r.availableAt).toLocaleDateString()}</td>
                <td className="px-4 py-3">
                  {r.holdReason ? (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-rust/15 text-rust font-medium">{r.holdReason}</span>
                  ) : (
                    <span className="text-xs text-white/30">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right space-x-1.5 whitespace-nowrap">
                  <button
                    type="button"
                    disabled={busyId === r.id}
                    onClick={() => act(r.id, "release")}
                    className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-emerald-600 disabled:opacity-50 hover:opacity-90"
                  >
                    {busyId === r.id ? <Loader2 size={13} className="animate-spin" /> : <PlayCircle size={13} />}
                    Release
                  </button>
                  {r.holdReason ? (
                    <button
                      type="button"
                      disabled={busyId === r.id}
                      onClick={() => act(r.id, "unhold")}
                      className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-white/15 hover:border-emerald-500 hover:text-emerald-400 disabled:opacity-50"
                    >
                      <XCircle size={13} /> Clear hold
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={busyId === r.id}
                      onClick={() => act(r.id, "hold")}
                      className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-white/15 hover:border-amber-500 hover:text-amber-400 disabled:opacity-50"
                    >
                      <PauseCircle size={13} /> Hold
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-white/40">
                  Nothing waiting on a payout right now.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
