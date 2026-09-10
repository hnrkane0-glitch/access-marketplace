import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handleApiError, userError } from "@/lib/api-error";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const reference = req.nextUrl.searchParams.get("reference");
    if (!reference) throw userError("Missing reference.");

    const payment = await db.payment.findUnique({ where: { providerReference: reference } });
    if (!payment || payment.userId !== user.id || payment.purpose !== "WALLET_TOPUP") {
      throw userError("Top-up not found.");
    }

    return NextResponse.json({ status: payment.status, amountKobo: payment.amountKobo });
  } catch (err) {
    return handleApiError(err);
  }
}
