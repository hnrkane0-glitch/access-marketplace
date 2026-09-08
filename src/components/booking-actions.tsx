"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, ApiError } from "@/lib/api-client";

interface Props {
  bookingId: string;
  status: string;
  isCustomer: boolean;
  isProvider: boolean;
}

export default function BookingActions({ bookingId, status, isCustomer, isProvider }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accessCode, setAccessCode] = useState("");
  const [showDisputeForm, setShowDisputeForm] = useState(false);
  const [disputeReason, setDisputeReason] = useState("");
  const [disputeDescription, setDisputeDescription] = useState("");

  async function runAction(action: string, extra?: Record<string, unknown>) {
    setError(null);
    setLoading(true);
    try {
      await apiFetch(`/api/bookings/${bookingId}`, {
        method: "PATCH",
        body: JSON.stringify({ action, ...extra }),
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function submitDispute() {
    setError(null);
    setLoading(true);
    try {
      await apiFetch(`/api/bookings/${bookingId}/dispute`, {
        method: "POST",
        body: JSON.stringify({ reason: disputeReason, description: disputeDescription }),
      });
      router.refresh();
      setShowDisputeForm(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  const canCancel = isCustomer && ["REQUESTED", "PAYMENT_PENDING", "PAID", "CONFIRMED"].includes(status);
  const canCheckIn = isProvider && status === "CONFIRMED";
  const canCheckOut = isProvider && status === "ACTIVE";
  const canComplete = isProvider && status === "CHECKOUT_PENDING";
  const canDispute =
    (isCustomer || isProvider) &&
    ["CONFIRMED", "CHECKED_IN", "ACTIVE", "CHECKOUT_PENDING", "COMPLETED", "PAYOUT_PENDING"].includes(
      status
    );

  return (
    <div className="mt-6 space-y-3">
      {error && (
        <p className="text-sm text-rust bg-rust/10 border border-rust/30 rounded-lg px-3 py-2">{error}</p>
      )}

      {canCheckIn && (
        <div className="flex gap-2">
          <input
            placeholder="Enter customer's access code"
            value={accessCode}
            onChange={(e) => setAccessCode(e.target.value)}
            className="flex-1 rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm"
          />
          <button
            disabled={loading || !accessCode}
            onClick={() => runAction("check_in", { accessCode })}
            className="px-4 py-2 rounded-lg bg-ink text-paper text-sm font-medium disabled:opacity-50"
          >
            Confirm check-in
          </button>
        </div>
      )}

      {canCheckOut && (
        <button
          disabled={loading}
          onClick={() => runAction("check_out")}
          className="px-4 py-2 rounded-lg bg-ink text-paper text-sm font-medium disabled:opacity-50"
        >
          Confirm check-out
        </button>
      )}

      {canComplete && (
        <button
          disabled={loading}
          onClick={() => runAction("complete")}
          className="px-4 py-2 rounded-lg bg-signal text-white text-sm font-medium disabled:opacity-50"
        >
          Mark completed & schedule payout
        </button>
      )}

      {canCancel && (
        <button
          disabled={loading}
          onClick={() => runAction("cancel")}
          className="px-4 py-2 rounded-lg border border-[var(--line)] text-sm font-medium disabled:opacity-50"
        >
          Cancel booking
        </button>
      )}

      {canDispute && !showDisputeForm && (
        <button
          onClick={() => setShowDisputeForm(true)}
          className="px-4 py-2 rounded-lg border border-rust/40 text-rust text-sm font-medium"
        >
          Report a problem
        </button>
      )}

      {showDisputeForm && (
        <div className="rounded-lg border border-rust/30 bg-rust/5 p-4 space-y-2">
          <input
            placeholder="Reason (e.g. damage, no-show)"
            value={disputeReason}
            onChange={(e) => setDisputeReason(e.target.value)}
            className="w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm"
          />
          <textarea
            placeholder="Describe what happened"
            value={disputeDescription}
            onChange={(e) => setDisputeDescription(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <button
              disabled={loading || !disputeReason || disputeDescription.length < 10}
              onClick={submitDispute}
              className="px-4 py-2 rounded-lg bg-rust text-white text-sm font-medium disabled:opacity-50"
            >
              Submit dispute
            </button>
            <button
              onClick={() => setShowDisputeForm(false)}
              className="px-4 py-2 rounded-lg border border-[var(--line)] text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
