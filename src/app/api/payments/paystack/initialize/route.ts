import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handleApiError, userError } from "@/lib/api-error";
import { initializeTransaction } from "@/lib/paystack";

const InitSchema = z.object({ bookingId: z.string() });

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const { bookingId } = InitSchema.parse(await req.json());

    // Amount is re-read from the DB row we created server-side in
    // POST /api/bookings — the client never gets to supply it here.
    const booking = await db.booking.findUnique({ where: { id: bookingId } });
    if (!booking || booking.customerId !== user.id) {
      throw userError("Booking not found.");
    }
    if (booking.status !== "PAYMENT_PENDING") {
      throw userError("This booking is not awaiting payment.");
    }

    const reference = `am_${bookingId}_${crypto.randomBytes(6).toString("hex")}`;

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    const result = await initializeTransaction({
      email: user.email,
      amountKobo: booking.totalAmountKobo,
      reference,
      callbackUrl: `${appUrl}/bookings/${bookingId}/confirming`,
      metadata: { bookingId },
    });

    await db.payment.create({
      data: {
        bookingId,
        provider: "paystack",
        providerReference: result.reference,
        amountKobo: booking.totalAmountKobo,
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
