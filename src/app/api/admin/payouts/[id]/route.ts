import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdminSession } from "@/lib/admin-auth";
import { handleApiError, userError } from "@/lib/api-error";
import { forceReleasePayout } from "@/jobs/release-payouts";

const Schema = z.object({
  action: z.enum(["release", "hold", "unhold"]),
  reason: z.string().max(300).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdminSession();
    const { id } = await params;
    const { action, reason } = Schema.parse(await req.json());

    if (action === "release") {
      try {
        await forceReleasePayout(id, reason ?? "Manual release from admin console");
      } catch (e) {
        throw userError(e instanceof Error ? e.message : "Could not release this payout.");
      }
      return NextResponse.json({ ok: true });
    }

    const payout = await db.payout.findUnique({ where: { id } });
    if (!payout) throw userError("Payout not found.");

    await db.payout.update({
      where: { id },
      data: { holdReason: action === "hold" ? reason ?? "ADMIN_HOLD" : null },
    });
    await db.auditLog.create({
      data: {
        actorId: null,
        action: action === "hold" ? "PAYOUT_HELD" : "PAYOUT_UNHELD",
        toValue: id,
        metadata: { via: "admin-console", reason },
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
