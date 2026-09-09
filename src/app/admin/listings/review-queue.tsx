"use client";

import { useState } from "react";
import { apiFetch, ApiError } from "@/lib/api-client";
import { Check, X, PauseCircle, Loader2 } from "lucide-react";

interface QueueListing {
  id: string;
  title: string;
  description: string;
  category: string;
  city: string;
  area: string | null;
  provider: { id: string; fullName: string; email: string };
  thumbnail: string | null;
  priceLabel: string;
  createdAt: string;
}

export default function ListingReviewQueue({
  initialListings,
}: {
  initialListings: QueueListing[];
}) {
  const [listings, setListings] = useState(initialListings);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function decide(id: string, action: "approve" | "reject" | "suspend") {
    setError(null);
    setBusyId(id);
    try {
      await apiFetch(`/api/admin/listings/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ action }),
      });
      setListings((cur) => cur.filter((l) => l.id !== id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setBusyId(null);
    }
  }

  if (listings.length === 0) {
    return (
      <div className="mt-8 rounded-2xl border border-dashed border-white/15 bg-white/5 p-8 text-center text-sm text-white/50">
        Nothing waiting for review right now.
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-4">
      {error && (
        <p className="text-sm text-rust bg-rust/10 border border-rust/30 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
      {listings.map((l) => (
        <div
          key={l.id}
          className="flex gap-4 rounded-2xl border border-white/10 bg-white/5 p-5"
        >
          <div className="w-20 h-20 rounded-lg overflow-hidden shrink-0 bg-white/10">
            {l.thumbnail ? (
              // eslint-disable-next-line @next/next/no-img-element -- provider-supplied media
              <img src={l.thumbnail} alt="" className="w-full h-full object-cover" />
            ) : null}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium">{l.title}</p>
            <p className="text-sm text-white/50">
              {l.category} · {l.area ? `${l.area}, ` : ""}
              {l.city} · {l.priceLabel}
            </p>
            <p className="text-sm text-white/50 mt-1 line-clamp-2">{l.description}</p>
            <p className="text-xs text-white/40 mt-2">
              By {l.provider.fullName} ({l.provider.email})
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                disabled={busyId === l.id}
                onClick={() => decide(l.id, "approve")}
                className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:opacity-90 disabled:opacity-50"
              >
                {busyId === l.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                Approve
              </button>
              <button
                type="button"
                disabled={busyId === l.id}
                onClick={() => decide(l.id, "reject")}
                className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg border border-white/15 hover:border-rust hover:text-rust disabled:opacity-50"
              >
                <X size={14} /> Reject
              </button>
              <button
                type="button"
                disabled={busyId === l.id}
                onClick={() => decide(l.id, "suspend")}
                className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg border border-white/15 hover:border-amber-500 hover:text-amber-400 disabled:opacity-50"
              >
                <PauseCircle size={14} /> Suspend
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
