"use client";

import { useState } from "react";
import { Ban, CheckCircle2, Loader2 } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api-client";

interface Row {
  id: string;
  name: string;
  email: string;
  isSuspended: boolean;
  totalSpentKobo: number;
  bookingCount: number;
  joined: string;
}

function naira(kobo: number): string {
  return `₦${(kobo / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export default function RenterTable({ rows: initialRows }: { rows: Row[] }) {
  const [rows, setRows] = useState(initialRows);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function toggleSuspend(id: string, suspend: boolean) {
    setBusyId(id);
    setError(null);
    try {
      await apiFetch(`/api/admin/users/${id}/suspend`, {
        method: "PATCH",
        body: JSON.stringify({ suspend }),
      });
      setRows((cur) => cur.map((r) => (r.id === id ? { ...r, isSuspended: suspend } : r)));
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
        <table className="w-full text-sm min-w-[720px]">
          <thead>
            <tr className="text-left text-xs text-white/40 uppercase tracking-wide border-b border-white/10">
              <th className="px-4 py-3 font-medium">Renter</th>
              <th className="px-4 py-3 font-medium">Bookings</th>
              <th className="px-4 py-3 font-medium">Total spent</th>
              <th className="px-4 py-3 font-medium">Status</th>
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
                <td className="px-4 py-3">{r.bookingCount}</td>
                <td className="px-4 py-3">{naira(r.totalSpentKobo)}</td>
                <td className="px-4 py-3">
                  {r.isSuspended ? (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-rust/15 text-rust font-medium">Suspended</span>
                  ) : (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-medium">Active</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    disabled={busyId === r.id}
                    onClick={() => toggleSuspend(r.id, !r.isSuspended)}
                    className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border disabled:opacity-50 ${
                      r.isSuspended
                        ? "border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10"
                        : "border-rust/40 text-rust hover:bg-rust/10"
                    }`}
                  >
                    {busyId === r.id ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : r.isSuspended ? (
                      <CheckCircle2 size={13} />
                    ) : (
                      <Ban size={13} />
                    )}
                    {r.isSuspended ? "Reinstate" : "Suspend"}
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-white/40">
                  No renters yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
