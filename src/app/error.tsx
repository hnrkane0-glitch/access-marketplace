"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Logged server-side too, but this makes sure it's visible in the
    // browser console and in Vercel's runtime logs for this deployment.
    console.error("[app error]", error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-6 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Something went wrong</h1>
      <p className="mt-2 text-[var(--ink-soft)]">
        This page hit an unexpected error. It's been logged — please try again, and if it keeps
        happening, let support know what you were doing right before this appeared.
      </p>
      <button
        onClick={reset}
        className="mt-6 rounded-full bg-black px-5 py-2.5 text-sm font-medium text-white hover:bg-black/85"
      >
        Try again
      </button>
    </div>
  );
}
