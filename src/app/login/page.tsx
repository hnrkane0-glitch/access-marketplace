"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch, ApiError } from "@/lib/api-client";
import { FormField, inputClass, primaryButtonClass } from "@/components/form";
import { Zap, LogIn } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await apiFetch("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-5 py-16 bg-gradient-to-br from-violet-50 via-white to-orange-50">
      <div className="w-full max-w-sm rounded-3xl border border-[var(--line)] bg-[var(--paper-raised)] card-shadow p-8 sm:p-10">
        <div className="w-11 h-11 rounded-xl bg-grad-brand text-white flex items-center justify-center pop-shadow">
          <LogIn size={20} />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight mt-4">Welcome back</h1>
        <p className="text-sm text-[var(--ink-soft)] mt-1">Log in to book or manage your listings.</p>

        <form onSubmit={onSubmit} className="mt-7 space-y-4">
          <FormField label="Email">
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />
          </FormField>
          <FormField label="Password">
            <input
              required
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
            />
          </FormField>

          {error && (
            <p className="text-sm text-rust bg-rust/10 border border-rust/30 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button type="submit" disabled={loading} className={primaryButtonClass}>
            {loading ? "Logging in…" : "Log in"}
          </button>
        </form>

        <p className="mt-6 text-sm text-[var(--ink-soft)] text-center">
          New here?{" "}
          <Link href="/signup" className="text-brass font-medium hover:underline">
            Create an account
          </Link>
        </p>

        <div className="mt-7 pt-5 border-t border-[var(--line)] flex items-center justify-center gap-1.5 text-xs text-[var(--ink-soft)]">
          <Zap size={12} className="text-brass" /> Secured by encrypted, escrow-backed payments
        </div>
      </div>
    </div>
  );
}
