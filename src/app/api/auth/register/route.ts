import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword, createSession } from "@/lib/auth";
import { handleApiError, userError } from "@/lib/api-error";

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters."),
  fullName: z.string().min(2),
  phone: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = RegisterSchema.parse(await req.json());

    const existing = await db.user.findUnique({ where: { email: body.email } });
    if (existing) {
      throw userError("An account with this email already exists.");
    }

    const passwordHash = await hashPassword(body.password);
    const user = await db.user.create({
      data: {
        email: body.email,
        phone: body.phone,
        fullName: body.fullName,
        passwordHash,
      },
    });

    await createSession(user.id, {
      userAgent: req.headers.get("user-agent") ?? undefined,
      ipAddress: req.headers.get("x-forwarded-for") ?? undefined,
    });

    // TODO(phase 1 wiring): send email verification link via the email
    // provider adapter once one is configured — see ARCHITECTURE.md §8.

    return NextResponse.json(
      { id: user.id, email: user.email, fullName: user.fullName },
      { status: 201 }
    );
  } catch (err) {
    return handleApiError(err);
  }
}
