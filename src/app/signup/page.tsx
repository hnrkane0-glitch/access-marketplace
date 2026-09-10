"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch, ApiError } from "@/lib/api-client";
import { FormField, inputClass, primaryButtonClass } from "@/components/form";
import { UserPlus, ShieldCheck, Wallet, Sparkles } from "lucide-react";

const PERKS = [
  { icon: ShieldCheck, text: "Escrow-protected payments on every booking" },
  { icon: Wallet, text: "List and start earning in minutes" },
  { icon: Sparkles, text: "One account works as renter and provider" },
];

export default function SignupPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await apiFetch("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ fullName, email, password }),
      });
      router.push("/packages");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-br from-violet-50 via-white to-orange-50 px-5 py-16">
      <div className="mx-auto max-w-4xl grid md:grid-cols-2 rounded-3xl overflow-hidden border border-[var(--line)] card-shadow">
        {/* left: pitch panel */}
        <div className="hidden md:flex flex-col justify-between bg-grad-dark text-white p-10">
          <div>
            <div className="w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center">
              <UserPlus size={20} />
            </div>
            <h2 className="text-2xl font-semibold tracking-tight mt-5 leading-snug">
              Join the marketplace for access, not ownership.
            </h2>
          </div>
          <ul className="space-y-4 mt-8">
            {PERKS.map((p) => (
              <li key={p.text} className="flex items-start gap-3 text-sm text-white/85">
                <span className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                  <p.icon size={15} className="text-orange-300" />
                </span>
                {p.text}
              </li>
            ))}
          </ul>
        </div>

        {/* right: form */}
        <div className="bg-[var(--paper-raised)] p-8 sm:p-10">
          <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
          <p className="mt-1 text-sm text-[var(--ink-soft)]">
            One account works as both a customer and a provider.
          </p>

          <form onSubmit={onSubmit} className="mt-7 space-y-4">
            <FormField label="Full name">
              <input
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className={inputClass}
              />
            </FormField>
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
                minLength={8}
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
              {loading ? "Creating account…" : "Create account"}
            </button>
          </form>

          <p className="mt-6 text-sm text-[var(--ink-soft)]">
            Already have an account?{" "}
            <Link href="/login" className="text-brass font-medium hover:underline">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
