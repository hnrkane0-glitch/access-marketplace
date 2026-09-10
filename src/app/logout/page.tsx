"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

export default function LogoutPage() {
  const router = useRouter();
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
      } catch {
        // Even if the request fails, still send them home — the
        // session cookie may be stale/invalid anyway.
      }
      if (cancelled) return;
      setDone(true);
      router.push("/");
      router.refresh();
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <div className="mx-auto max-w-sm px-5 py-24 text-center">
      <div className="mx-auto w-10 h-10 rounded-full bg-[var(--paper-raised)] border border-[var(--line)] flex items-center justify-center">
        <LogOut size={17} className={done ? "text-emerald-600" : "text-[var(--ink-soft)] animate-pulse"} />
      </div>
      <p className="mt-6 font-medium">{done ? "You're logged out." : "Logging you out…"}</p>
    </div>
  );
}
