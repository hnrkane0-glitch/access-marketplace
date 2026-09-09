"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ShieldAlert, Lock, User, Loader2 } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api-client";

export default function AdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await apiFetch("/api/admin/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
      router.push("/admin");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#05060f] text-white flex items-center justify-center px-5">
      {/* futuristic grid + glow backdrop */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(rgba(109,61,240,0.16) 1px, transparent 1px), linear-gradient(90deg, rgba(109,61,240,0.16) 1px, transparent 1px)",
          backgroundSize: "42px 42px",
          maskImage: "radial-gradient(ellipse 70% 60% at 50% 40%, black 40%, transparent 90%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[700px] rounded-full blur-3xl opacity-40"
        style={{ background: "radial-gradient(circle, #6d3df0 0%, transparent 65%)" }}
      />

      <div className="relative w-full max-w-sm">
        <div className="flex flex-col items-center text-center mb-8">
          <span className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-grad-brand pop-shadow mb-4">
            <ShieldAlert size={26} />
          </span>
          <h1 className="text-2xl font-semibold tracking-tight">Admin console</h1>
          <p className="mt-1 text-sm text-white/50">
            Restricted access. Providers and renters cannot sign in here.
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 space-y-4 shadow-[0_0_60px_-15px_rgba(109,61,240,0.6)]"
        >
          {error && (
            <p className="text-sm text-rust bg-rust/10 border border-rust/30 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <label className="block">
            <span className="text-xs font-medium text-white/60 mb-1.5 block">Username</span>
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 focus-within:border-brass transition-colors">
              <User size={16} className="text-white/40 shrink-0" />
              <input
                autoFocus
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="bg-transparent outline-none w-full text-sm placeholder:text-white/30"
                placeholder="admin"
                autoComplete="username"
              />
            </div>
          </label>

          <label className="block">
            <span className="text-xs font-medium text-white/60 mb-1.5 block">Password</span>
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 focus-within:border-brass transition-colors">
              <Lock size={16} className="text-white/40 shrink-0" />
              <input
                required
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-transparent outline-none w-full text-sm placeholder:text-white/30"
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>
          </label>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-grad-brand py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 pop-shadow"
          >
            {loading && <Loader2 size={15} className="animate-spin" />}
            Enter console
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-white/30">
          Access Marketplace &middot; Internal use only
        </p>
      </div>
    </div>
  );
}
