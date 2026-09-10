import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handleApiError } from "@/lib/api-error";

export async function GET() {
  try {
    const user = await requireUser();
    const subscription = await db.subscription.findUnique({ where: { userId: user.id } });
    if (!subscription) return NextResponse.json({ subscription: null });

    return NextResponse.json({
      subscription: {
        tier: subscription.tier,
        status: subscription.status,
        trialEndsAt: subscription.trialEndsAt,
        currentPeriodEnd: subscription.currentPeriodEnd,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
