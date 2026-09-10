import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handleApiError, userError } from "@/lib/api-error";
import { initializeTransaction } from "@/lib/paystack";

const InitSchema = z.object({ amountKobo: z.number().int().positive() });

// A sane floor so nobody fat-fingers ₦1 and generates a support ticket.
const MIN_TOPUP_KOBO = 100_00; // ₦100

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const { amountKobo } = InitSchema.parse(await req.json());

    if (amountKobo < MIN_TOPUP_KOBO) {
      throw userError(`Minimum top-up is ₦${(MIN_TOPUP_KOBO / 100).toLocaleString()}.`);
    }

    const reference = `topup_${user.id}_${crypto.randomBytes(6).toString("hex")}`;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    const result = await initializeTransaction({
      email: user.email,
      amountKobo,
      reference,
      callbackUrl: `${appUrl}/wallet/topup/confirming`,
      metadata: { purpose: "WALLET_TOPUP", userId: user.id },
    });

    await db.payment.create({
      data: {
        userId: user.id,
        bookingId: null,
        purpose: "WALLET_TOPUP",
        provider: "paystack",
        providerReference: result.reference,
        amountKobo,
        status: "INITIATED",
      },
    });

    return NextResponse.json({
      authorizationUrl: result.authorizationUrl,
      reference: result.reference,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
