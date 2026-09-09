import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdminSession } from "@/lib/admin-auth";
import { handleApiError, userError } from "@/lib/api-error";

const Schema = z.object({ suspend: z.boolean() });

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdminSession();
    const { id } = await params;
    const { suspend } = Schema.parse(await req.json());

    const user = await db.user.findUnique({ where: { id } });
    if (!user) throw userError("User not found.");
    if (user.isAdmin) throw userError("Cannot suspend an admin account.");

    const updated = await db.$transaction(async (tx) => {
      const result = await tx.user.update({
        where: { id },
        data: { isSuspended: suspend },
      });
      await tx.auditLog.create({
        data: {
          actorId: null,
          action: suspend ? "USER_SUSPENDED" : "USER_REINSTATED",
          fromValue: String(user.isSuspended),
          toValue: String(suspend),
          metadata: { via: "admin-console", userId: id },
        },
      });
      return result;
    });

    return NextResponse.json({ id: updated.id, isSuspended: updated.isSuspended });
  } catch (err) {
    return handleApiError(err);
  }
}
