"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, ApiError } from "@/lib/api-client";
import { FormField, inputClass, primaryButtonClass } from "@/components/form";

export default function ProviderOnboardingPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await apiFetch("/api/provider/onboard", {
        method: "POST",
        body: JSON.stringify({ displayName, bio: bio || undefined }),
      });
      router.push("/provider/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm px-5 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">Become a provider</h1>
      <p className="mt-1 text-sm text-[var(--ink-soft)]">
        List your unused space, equipment, skills, or capacity — your same account keeps
        working as a customer too.
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <FormField label="Public display name">
          <input
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className={inputClass}
            placeholder="e.g. Lekki Studio Rentals"
          />
        </FormField>
        <FormField label="Short bio (optional)">
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            className={inputClass}
            rows={3}
          />
        </FormField>

        {error && (
          <p className="text-sm text-rust bg-rust/10 border border-rust/30 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <button type="submit" disabled={loading} className={primaryButtonClass}>
          {loading ? "Setting up…" : "Start providing"}
        </button>
      </form>
    </div>
  );
}
