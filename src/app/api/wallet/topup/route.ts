import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handleApiError, userError } from "@/lib/api-error";
import { initializeTransaction } from "@/lib/paystack";

const Schema = z.object({ amountKobo: z.number().int().min(100).max(50_000_000) });

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const { amountKobo } = Schema.parse(await req.json());
    const reference = `wallet_${user.id}_${crypto.randomBytes(8).toString("hex")}`;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    const result = await initializeTransaction({
      email: user.email,
      amountKobo,
      reference,
      callbackUrl: `${appUrl}/dashboard?topup=confirming`,
      metadata: { type: "WALLET_TOPUP", userId: user.id },
    });

    await db.walletTopup.create({
      data: { userId: user.id, providerReference: result.reference, amountKobo, status: "PENDING" },
    });

    return NextResponse.json({ authorizationUrl: result.authorizationUrl, reference: result.reference });
  } catch (err) {
    return handleApiError(err);
  }
}
