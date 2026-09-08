import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { UnauthorizedError, ForbiddenError } from "@/lib/auth";

/**
 * Central error → HTTP response mapping. Never leaks raw error messages
 * (stack traces, Prisma internals, DB constraint names) to the client —
 * spec §71: "never show raw server errors to customers." Logs the full
 * error server-side for observability instead.
 */
export function handleApiError(err: unknown): NextResponse {
  if (err instanceof UnauthorizedError) {
    return NextResponse.json({ error: err.message }, { status: 401 });
  }
  if (err instanceof ForbiddenError) {
    return NextResponse.json({ error: err.message }, { status: 403 });
  }
  if (err instanceof ZodError) {
    return NextResponse.json(
      { error: "Invalid request.", details: err.flatten() },
      { status: 400 }
    );
  }
  if (err instanceof Error && (err as { expectedUserError?: boolean }).expectedUserError) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }

  console.error("Unhandled API error:", err);
  return NextResponse.json(
    { error: "Something went wrong. Please try again." },
    { status: 500 }
  );
}

/** Marks an Error as safe to show verbatim to the client. */
export function userError(message: string): Error {
  const err = new Error(message) as Error & { expectedUserError: boolean };
  err.expectedUserError = true;
  return err;
}
