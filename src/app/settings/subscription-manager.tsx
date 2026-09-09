"use client";

import { useState } from "react";
import { apiFetch, ApiError } from "@/lib/api-client";

export default function SubscriptionManager({ tier, status }: { tier: string; status: string }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function manage() {
    setLoading(true); setMessage("");
    try {
      const result = await apiFetch<{ link: string }>("/api/subscriptions/manage");
      window.location.href = result.link;
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : "Could not open subscription management.");
      setLoading(false);
    }
  }

  return <main className="mx-auto max-w-xl px-5 py-12">
    <h1 className="text-3xl font-semibold">Membership & billing</h1>
    <div className="mt-6 rounded-2xl border border-[var(--line)] bg-white p-6 card-shadow">
      <p className="text-xs uppercase tracking-widest text-[var(--ink-soft)]">Current plan</p>
      <p className="mt-2 text-2xl font-semibold">{tier}</p>
      <p className="mt-1 text-sm text-[var(--ink-soft)]">Status: {status}</p>
      <p className="mt-5 text-sm">Your recurring card subscription is managed securely by Paystack. You can cancel or update your card from the Paystack management page.</p>
      <button onClick={manage} disabled={loading} className="mt-6 rounded-xl bg-ink text-white px-5 py-3 text-sm font-semibold">
        {loading ? "Opening…" : "Manage / cancel subscription"}
      </button>
      {message && <p className="mt-4 text-sm text-rose-600">{message}</p>}
    </div>
  </main>;
}
