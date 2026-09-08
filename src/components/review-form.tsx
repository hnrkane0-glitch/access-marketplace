"use client";

import { useState } from "react";
import { apiFetch, ApiError } from "@/lib/api-client";
import { Star, Loader2 } from "lucide-react";

export default function ReviewForm({
  bookingId,
  subjectLabel,
}: {
  bookingId: string;
  subjectLabel: string;
}) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit() {
    if (rating === 0) {
      setError("Pick a star rating first.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await apiFetch(`/api/bookings/${bookingId}/reviews`, {
        method: "POST",
        body: JSON.stringify({ overallRating: rating, comment: comment.trim() || undefined }),
      });
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="mt-6 pt-6 border-t border-[var(--line)]">
        <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
          Thanks — your review of {subjectLabel} was posted.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6 pt-6 border-t border-[var(--line)]">
      <p className="text-sm font-medium mb-2">Leave a review for {subjectLabel}</p>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onMouseEnter={() => setHoverRating(n)}
            onMouseLeave={() => setHoverRating(0)}
            onClick={() => setRating(n)}
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
          >
            <Star
              size={22}
              className={
                n <= (hoverRating || rating)
                  ? "text-brass fill-brass"
                  : "text-[var(--line)]"
              }
            />
          </button>
        ))}
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={3}
        placeholder="How did it go? (optional)"
        className="mt-3 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm focus:border-brass focus:ring-2 focus:ring-brass/20 outline-none"
      />
      {error && <p className="text-xs text-rust mt-2">{error}</p>}
      <button
        type="button"
        disabled={loading}
        onClick={submit}
        className="mt-3 flex items-center gap-1.5 px-4 py-2 rounded-lg bg-grad-brand text-white text-sm font-medium disabled:opacity-50"
      >
        {loading && <Loader2 size={14} className="animate-spin" />}
        Post review
      </button>
    </div>
  );
}
