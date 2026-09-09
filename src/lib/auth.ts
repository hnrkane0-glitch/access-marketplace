import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import crypto from "crypto";

const SESSION_COOKIE = "am_session";
const SESSION_TTL_DAYS = 30;

function requireSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    // Fail loudly rather than silently signing with a guessable default.
    throw new Error(
      "SESSION_SECRET is not set. Set it in .env before starting the server."
    );
  }
  return secret;
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

export async function verifyPassword(
  plain: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

interface SessionPayload {
  userId: string;
  sid: string; // session row id, so a session can be revoked server-side
}

/**
 * Creates a Session row (so it can be revoked/audited) and a signed JWT
 * that references it. The JWT itself carries no authorization claims other
 * than "this is user X's session Y" — role/permission checks always hit
 * the database fresh, never trust claims embedded in the token.
 */
export async function createSession(
  userId: string,
  meta: { userAgent?: string; ipAddress?: string }
): Promise<string> {
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

  const session = await db.session.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
      userAgent: meta.userAgent,
      ipAddress: meta.ipAddress,
    },
  });

  const payload: SessionPayload = { userId, sid: session.id };
  const jwtToken = jwt.sign(payload, requireSecret(), {
    expiresIn: `${SESSION_TTL_DAYS}d`,
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, jwtToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_DAYS * 24 * 60 * 60,
  });

  return jwtToken;
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    try {
      const payload = jwt.verify(token, requireSecret()) as SessionPayload;
      await db.session.delete({ where: { id: payload.sid } }).catch(() => {});
    } catch {
      // token already invalid — nothing to clean up server-side
    }
  }
  cookieStore.delete(SESSION_COOKIE);
}

export interface CurrentUser {
  id: string;
  email: string;
  fullName: string;
  isAdmin: boolean;
  isProvider: boolean;
  isSuspended: boolean;
  subscriptionStatus: "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELLED" | "EXPIRED" | "PENDING" | null;
  subscriptionTier: "STARTER" | "ETERNAL" | "PRO" | null;
}

/**
 * The single source of truth for "who is making this request." Every
 * protected API route and server component should call this — never
 * read a userId from a request body or query param for authorization.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  let payload: SessionPayload;
  try {
    payload = jwt.verify(token, requireSecret()) as SessionPayload;
  } catch {
    return null;
  }

  const session = await db.session.findUnique({ where: { id: payload.sid } });
  if (!session || session.expiresAt < new Date()) return null;

  const user = await db.user.findUnique({
    where: { id: payload.userId },
    include: { providerProfile: true, accountSubscriptions: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  if (!user || user.isSuspended) return null;

  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    isAdmin: user.isAdmin,
    isProvider: !!user.providerProfile,
    isSuspended: user.isSuspended,
    subscriptionStatus: user.accountSubscriptions[0]?.status ?? null,
    subscriptionTier: user.accountSubscriptions[0]?.tier ?? null,
  };
}

export class UnauthorizedError extends Error {
  status = 401;
}
export class ForbiddenError extends Error {
  status = 403;
}

/** Throws if there's no session. Use at the top of any protected route. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError("Sign in required.");
  return user;
}

/** Throws unless the current user is an admin. */
export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (!user.isAdmin) throw new ForbiddenError("Admin access required.");
  return user;
}

/** Throws unless the current user has a provider profile. */
export async function requireProvider(): Promise<CurrentUser> {
  const user = await requireUser();
  if (!user.isProvider) throw new ForbiddenError("Provider account required.");
  return user;
}
