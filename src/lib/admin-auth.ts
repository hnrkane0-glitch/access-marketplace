import jwt from "jsonwebtoken";
import { cookies } from "next/headers";

/**
 * This is a DELIBERATELY separate authentication system from
 * src/lib/auth.ts. Regular users (renters, providers) authenticate
 * against the `User` table and get an `am_session` cookie. The admin
 * console authenticates against a single username/password pair from
 * the environment and gets a completely different cookie
 * (`am_admin_session`).
 *
 * Why separate rather than reusing `User.isAdmin`: a renter or provider
 * account can never, by any combination of app bugs or database rows,
 * end up with a valid admin session — there is no `isAdmin` flag to flip
 * and no user row to compromise. The only way in is the credentials
 * below. Providers/renters who are logged into their own account and
 * visit /admin will simply be bounced to /admin-login like anyone else.
 */

const ADMIN_COOKIE = "am_admin_session";
const ADMIN_TTL_HOURS = 12;

function adminUsername(): string {
  return process.env.ADMIN_USERNAME?.trim() || "admin";
}

function adminPassword(): string {
  return process.env.ADMIN_PASSWORD?.trim() || "password";
}

function requireSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error(
      "SESSION_SECRET is not set. Set it in .env before starting the server."
    );
  }
  return secret;
}

export function verifyAdminCredentials(username: string, password: string): boolean {
  return username === adminUsername() && password === adminPassword();
}

interface AdminPayload {
  admin: true;
}

export async function createAdminSession(): Promise<void> {
  const token = jwt.sign({ admin: true } satisfies AdminPayload, requireSecret(), {
    expiresIn: `${ADMIN_TTL_HOURS}h`,
  });
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ADMIN_TTL_HOURS * 60 * 60,
  });
}

export async function destroyAdminSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_COOKIE);
}

export async function isAdminAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE)?.value;
  if (!token) return false;
  try {
    const payload = jwt.verify(token, requireSecret()) as AdminPayload;
    return payload.admin === true;
  } catch {
    return false;
  }
}

export class AdminUnauthorizedError extends Error {
  status = 401;
}

/** Throws unless the admin console session cookie is valid. Use at the
 * top of every /api/admin/* route handler. */
export async function requireAdminSession(): Promise<void> {
  const ok = await isAdminAuthenticated();
  if (!ok) throw new AdminUnauthorizedError("Admin session required.");
}
