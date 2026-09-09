"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LogoutPage() {
  const router = useRouter();
  useEffect(() => {
    fetch("/api/auth/logout", { method: "POST", credentials: "include" }).finally(() => router.replace("/"));
  }, [router]);
  return <main className="min-h-[60vh] flex items-center justify-center"><p className="text-sm text-[var(--ink-soft)]">Signing you out…</p></main>;
}
