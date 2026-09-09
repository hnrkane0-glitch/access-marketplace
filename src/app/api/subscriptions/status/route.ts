import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handleApiError } from "@/lib/api-error";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const reference = new URL(req.url).searchParams.get("reference");
    const sub = await db.accountSubscription.findFirst({
      where: { userId: user.id, ...(reference ? { lastReference: reference } : {}) },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ status: sub?.status ?? "NONE", tier: sub?.tier ?? null });
  } catch (err) {
    return handleApiError(err);
  }
}
