import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handleApiError, userError } from "@/lib/api-error";
import { initializeTransaction } from "@/lib/paystack";

const plans = {
  STARTER: { code: "PLN_4fj6ah6f5oo2tlx", verification: true },
  ETERNAL: { code: "PLN_moo8asxaof1nqjl", verification: false },
  PRO: { code: "PLN_w7pnequ8jp3hc5d", verification: false },
} as const;

const Schema = z.object({ tier: z.enum(["STARTER", "ETERNAL", "PRO"]) });

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const { tier } = Schema.parse(await req.json());
    const plan = plans[tier];

    const existing = await db.accountSubscription.findFirst({
      where: { userId: user.id, status: { in: ["PENDING", "TRIALING", "ACTIVE"] } },
    });
    if (existing) throw userError("You already have an active or pending plan.");

    const reference = `sub_${user.id}_${crypto.randomBytes(8).toString("hex")}`;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    const result = await initializeTransaction({
      email: user.email,
      amountKobo: tier === "STARTER" ? 10000 : 100,
      reference,
      callbackUrl: `${appUrl}/subscription/complete?reference=${encodeURIComponent(reference)}`,
      metadata: {
        type: tier === "STARTER" ? "STARTER_CARD_VERIFICATION" : "SUBSCRIPTION_PLAN",
        userId: user.id,
        tier,
        planCode: plan.code,
      },
      ...(tier === "ETERNAL" || tier === "PRO" ? { planCode: plan.code, channels: ["card"] } : {}),
    });

    await db.accountSubscription.create({
      data: {
        userId: user.id,
        tier,
        planCode: plan.code,
        status: "PENDING",
        lastReference: result.reference,
      },
    });

    return NextResponse.json({ authorizationUrl: result.authorizationUrl, reference: result.reference });
  } catch (err) {
    return handleApiError(err);
  }
}
