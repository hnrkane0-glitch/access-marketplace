"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";

export default function ConfirmingPackagePage() {
  return (
    <Suspense fallback={null}>
      <ConfirmingPackageInner />
    </Suspense>
  );
}

function ConfirmingPackageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const tier = searchParams.get("tier");
  const [status, setStatus] = useState<"loading" | "ready" | "timedOut">("loading");
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch("/api/subscriptions/me", { credentials: "include" });
        const data = await res.json();
        if (cancelled) return;

        if (data.subscription && ["TRIALING", "ACTIVE"].includes(data.subscription.status)) {
          setStatus("ready");
          return;
        }
      } catch {
        // transient — keep polling
      }
      if (!cancelled) setAttempts((n) => n + 1);
    }

    if (attempts >= 15) {
      setStatus("timedOut");
      return;
    }

    const t = setTimeout(poll, 2000);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [attempts]);

  useEffect(() => {
    if (status === "ready") {
      const t = setTimeout(() => {
        router.push("/dashboard");
        router.refresh();
      }, 1500);
      return () => clearTimeout(t);
    }
  }, [status, router]);

  return (
    <div className="mx-auto max-w-sm px-5 py-24 text-center">
      {status === "loading" && (
        <>
          <div className="mx-auto w-10 h-10 rounded-full border-2 border-brass border-t-transparent animate-spin" />
          <p className="mt-6 font-medium">Setting up your {tier ? tier.toLowerCase() : ""} plan…</p>
          <p className="mt-1 text-sm text-[var(--ink-soft)]">This usually takes a few seconds.</p>
        </>
      )}
      {status === "ready" && (
        <>
          <CheckCircle2 size={36} className="mx-auto text-emerald-600" />
          <p className="mt-4 font-medium">You&apos;re all set.</p>
          <p className="mt-1 text-sm text-[var(--ink-soft)]">Taking you to your dashboard…</p>
        </>
      )}
      {status === "timedOut" && (
        <>
          <p className="font-medium">This is taking longer than expected.</p>
          <p className="mt-1 text-sm text-[var(--ink-soft)]">
            Your payment may still be processing. Try refreshing your dashboard in a moment.
          </p>
        </>
      )}
    </div>
  );
}
