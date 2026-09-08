import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handleApiError, userError } from "@/lib/api-error";

const OnboardSchema = z.object({
  displayName: z.string().min(2),
  bio: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = OnboardSchema.parse(await req.json());

    const existing = await db.providerProfile.findUnique({ where: { userId: user.id } });
    if (existing) {
      throw userError("You already have a provider profile.");
    }

    const profile = await db.providerProfile.create({
      data: {
        userId: user.id,
        displayName: body.displayName,
        bio: body.bio,
      },
    });

    return NextResponse.json({ id: profile.id }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
