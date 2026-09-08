import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handleApiError } from "@/lib/api-error";

/** GET /api/notifications — most recent 30, plus unread count. */
export async function GET() {
  try {
    const user = await requireUser();

    const [notifications, unreadCount] = await Promise.all([
      db.notification.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
      db.notification.count({ where: { userId: user.id, readAt: null } }),
    ]);

    return NextResponse.json({ results: notifications, unreadCount });
  } catch (err) {
    return handleApiError(err);
  }
}

/** PATCH /api/notifications — mark every unread notification as read. */
export async function PATCH() {
  try {
    const user = await requireUser();
    await db.notification.updateMany({
      where: { userId: user.id, readAt: null },
      data: { readAt: new Date() },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
