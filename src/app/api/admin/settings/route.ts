import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminSession } from "@/lib/admin-auth";
import { handleApiError } from "@/lib/api-error";
import { setSetting } from "@/lib/platform-settings";
import { db } from "@/lib/db";

const Schema = z.object({
  payoutHoldDays: z.number().int().min(0).max(60),
  minWithdrawalKobo: z.number().int().min(0),
});

export async function PATCH(req: NextRequest) {
  try {
    await requireAdminSession();
    const { payoutHoldDays, minWithdrawalKobo } = Schema.parse(await req.json());
    await setSetting("payoutHoldDays", payoutHoldDays);
    await setSetting("minWithdrawalKobo", minWithdrawalKobo);
    await db.auditLog.create({
      data: {
        actorId: null,
        action: "PLATFORM_SETTINGS_UPDATED",
        metadata: { via: "admin-console", payoutHoldDays, minWithdrawalKobo },
      },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
