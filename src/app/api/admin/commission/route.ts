import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminSession } from "@/lib/admin-auth";
import { handleApiError } from "@/lib/api-error";
import { setSetting } from "@/lib/platform-settings";
import { db } from "@/lib/db";

const Schema = z.object({ platformCommissionBps: z.number().int().min(0).max(10000) });

export async function PATCH(req: NextRequest) {
  try {
    await requireAdminSession();
    const { platformCommissionBps } = Schema.parse(await req.json());
    await setSetting("platformCommissionBps", platformCommissionBps);
    await db.auditLog.create({
      data: {
        actorId: null,
        action: "PLATFORM_COMMISSION_UPDATED",
        toValue: String(platformCommissionBps),
        metadata: { via: "admin-console" },
      },
    });
    return NextResponse.json({ ok: true, platformCommissionBps });
  } catch (err) {
    return handleApiError(err);
  }
}
