"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api-client";
import { Loader2, CheckCircle2 } from "lucide-react";

export default function SubscriptionCompletePage() {
  const params = useSearchParams();
  const router = useRouter();
  const reference = params.get("reference") ?? "";
  const [status, setStatus] = useState("Checking your Paystack payment…");

  useEffect(() => {
    let attempts = 0;
    const poll = async () => {
      try {
        const data = await apiFetch<{ status: string }>(`/api/subscriptions/status?reference=${encodeURIComponent(reference)}`);
        if (["ACTIVE", "TRIALING"].includes(data.status)) {
          setStatus("Plan activated. Taking you to your dashboard…");
          setTimeout(() => router.push("/dashboard"), 700);
          return;
        }
        if (data.status === "PENDING" && attempts < 20) {
          attempts++;
          setStatus("Payment received. We are waiting for Paystack to confirm your plan…");
          setTimeout(poll, 1500);
          return;
        }
        setStatus("We could not confirm the plan yet. Please wait a few minutes and refresh.");
      } catch {
        setStatus("Checking…");
        if (attempts < 20) { attempts++; setTimeout(poll, 1500); }
      }
    };
    poll();
    return () => {};
  }, [reference, router]);

  return <main className="min-h-[70vh] flex items-center justify-center px-5">
    <div className="max-w-md text-center">
      {status.includes("activated") ? <CheckCircle2 size={48} className="mx-auto text-emerald-600"/> : <Loader2 size={42} className="mx-auto animate-spin text-brass"/>}
      <h1 className="mt-5 text-2xl font-semibold">Membership checkout</h1>
      <p className="mt-2 text-sm text-[var(--ink-soft)]">{status}</p>
    </div>
  </main>;
}
