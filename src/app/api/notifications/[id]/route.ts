import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handleApiError, userError } from "@/lib/api-error";

/** PATCH /api/notifications/[id] — mark a single notification read. */
export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;

    const notification = await db.notification.findUnique({ where: { id } });
    if (!notification || notification.userId !== user.id) {
      throw userError("Notification not found.");
    }

    await db.notification.update({ where: { id }, data: { readAt: new Date() } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
