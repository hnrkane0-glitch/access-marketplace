import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handleApiError, userError } from "@/lib/api-error";
import { initializeTransaction, fetchPlan } from "@/lib/paystack";
import { planCodeForTier, TRIAL_CARD_VERIFY_KOBO, type PackageTier } from "@/lib/subscription-plans";

const StartSchema = z.object({ tier: z.enum(["STARTER", "ETERNAL", "PRO"]) });

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const { tier } = StartSchema.parse(await req.json()) as { tier: PackageTier };

    const existing = await db.subscription.findUnique({ where: { userId: user.id } });
    if (existing && (existing.status === "ACTIVE" || existing.status === "TRIALING")) {
      throw userError("You already have an active plan.");
    }

    const planCode = planCodeForTier(tier);

    // Starter is free for 7 days but still needs a real card on file for
    // when the trial ends — we charge a small refundable amount just to
    // tokenize the card. Eternal/Pro charge their real configured price
    // right away (pulled live from Paystack, never hardcoded here).
    const amountKobo =
      tier === "STARTER" ? TRIAL_CARD_VERIFY_KOBO : (await fetchPlan(planCode)).amountKobo;

    const reference = `sub_${tier.toLowerCase()}_${user.id}_${crypto.randomBytes(6).toString("hex")}`;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    const result = await initializeTransaction({
      email: user.email,
      amountKobo,
      reference,
      callbackUrl: `${appUrl}/packages/confirming?tier=${tier}`,
      metadata: {
        purpose: "SUBSCRIPTION",
        tier,
        userId: user.id,
        trial: tier === "STARTER",
      },
    });

    await db.payment.create({
      data: {
        userId: user.id,
        bookingId: null,
        purpose: "SUBSCRIPTION",
        provider: "paystack",
        providerReference: result.reference,
        amountKobo,
        status: "INITIATED",
      },
    });

    return NextResponse.json({ authorizationUrl: result.authorizationUrl });
  } catch (err) {
    return handleApiError(err);
  }
}
