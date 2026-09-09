import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdminSession } from "@/lib/admin-auth";
import { handleApiError, userError } from "@/lib/api-error";
import { LedgerEntryStatus, LedgerEntryType } from "@prisma/client";

const Schema = z.object({
  email: z.string().email(),
  amountKobo: z.number().int().positive(),
  direction: z.enum(["CREDIT", "DEBIT"]),
  note: z.string().max(300).optional(),
});

export async function POST(req: NextRequest) {
  try {
    await requireAdminSession();
    const { email, amountKobo, direction, note } = Schema.parse(await req.json());

    const user = await db.user.findUnique({ where: { email } });
    if (!user) throw userError("No user found with that email.");

    await db.$transaction(async (tx) => {
      await tx.ledgerEntry.create({
        data: {
          userId: user.id,
          type: direction === "CREDIT" ? LedgerEntryType.ADMIN_CREDIT : LedgerEntryType.ADMIN_DEBIT,
          direction,
          amountKobo,
          status: LedgerEntryStatus.AVAILABLE,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: null,
          action: direction === "CREDIT" ? "ADMIN_SEND_MONEY_CREDIT" : "ADMIN_SEND_MONEY_DEBIT",
          toValue: user.id,
          metadata: { via: "admin-console", amountKobo, note },
        },
      });

      await tx.notification.create({
        data: {
          userId: user.id,
          type: direction === "CREDIT" ? "ADMIN_CREDIT" : "ADMIN_DEBIT",
          title: direction === "CREDIT" ? "Funds added to your account" : "Funds deducted from your account",
          body:
            (direction === "CREDIT"
              ? `₦${(amountKobo / 100).toLocaleString()} was credited to your account by the platform.`
              : `₦${(amountKobo / 100).toLocaleString()} was deducted from your account by the platform.`) +
            (note ? ` Note: ${note}` : ""),
        },
      });
    });

    return NextResponse.json({ ok: true, userId: user.id });
  } catch (err) {
    return handleApiError(err);
  }
}
