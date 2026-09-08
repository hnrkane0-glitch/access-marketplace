import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { verifyPassword, createSession } from "@/lib/auth";
import { handleApiError, userError } from "@/lib/api-error";

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const body = LoginSchema.parse(await req.json());

    const user = await db.user.findUnique({ where: { email: body.email } });
    // Deliberately identical error for "no such user" and "wrong password"
    // so login doesn't leak which emails are registered.
    if (!user || !(await verifyPassword(body.password, user.passwordHash))) {
      throw userError("Incorrect email or password.");
    }
    if (user.isSuspended) {
      throw userError("This account has been suspended. Contact support.");
    }

    await createSession(user.id, {
      userAgent: req.headers.get("user-agent") ?? undefined,
      ipAddress: req.headers.get("x-forwarded-for") ?? undefined,
    });

    return NextResponse.json({ id: user.id, email: user.email, fullName: user.fullName });
  } catch (err) {
    return handleApiError(err);
  }
}
