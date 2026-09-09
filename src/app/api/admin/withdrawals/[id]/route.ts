import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdminSession } from "@/lib/admin-auth";
import { handleApiError, userError } from "@/lib/api-error";
import { LedgerEntryStatus, LedgerEntryType } from "@prisma/client";

const Schema = z.object({
  action: z.enum(["complete", "fail"]),
  failureReason: z.string().max(300).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdminSession();
    const { id } = await params;
    const { action, failureReason } = Schema.parse(await req.json());

    const withdrawal = await db.withdrawal.findUnique({ where: { id } });
    if (!withdrawal) throw userError("Withdrawal not found.");
    if (withdrawal.status === "COMPLETED" || withdrawal.status === "FAILED") {
      throw userError("This withdrawal has already been resolved.");
    }

    await db.$transaction(async (tx) => {
      const reservedEntry = await tx.ledgerEntry.findFirst({
        where: {
          userId: withdrawal.userId,
          type: LedgerEntryType.WITHDRAWAL_REQUESTED,
          amountKobo: withdrawal.amountKobo,
          status: LedgerEntryStatus.RESERVED,
        },
        orderBy: { createdAt: "asc" },
      });

      if (action === "complete") {
        if (reservedEntry) {
          await tx.ledgerEntry.update({
            where: { id: reservedEntry.id },
            data: { status: LedgerEntryStatus.RELEASED },
          });
        }
        await tx.ledgerEntry.create({
          data: {
            userId: withdrawal.userId,
            type: LedgerEntryType.WITHDRAWAL_COMPLETED,
            direction: "DEBIT",
            amountKobo: withdrawal.amountKobo,
            status: LedgerEntryStatus.RELEASED,
          },
        });
        await tx.withdrawal.update({
          where: { id },
          data: { status: "COMPLETED", processedAt: new Date() },
        });
        await tx.notification.create({
          data: {
            userId: withdrawal.userId,
            type: "WITHDRAWAL_COMPLETED",
            title: "Withdrawal sent",
            body: `₦${(withdrawal.amountKobo / 100).toLocaleString()} has been sent to your bank account.`,
          },
        });
      } else {
        if (reservedEntry) {
          await tx.ledgerEntry.update({
            where: { id: reservedEntry.id },
            data: { status: LedgerEntryStatus.REVERSED },
          });
          await tx.ledgerEntry.create({
            data: {
              userId: withdrawal.userId,
              type: LedgerEntryType.ADMIN_CREDIT,
              direction: "CREDIT",
              amountKobo: withdrawal.amountKobo,
              status: LedgerEntryStatus.AVAILABLE,
              reversalOfId: reservedEntry.id,
            },
          });
        }
        await tx.withdrawal.update({
          where: { id },
          data: {
            status: "FAILED",
            processedAt: new Date(),
            failureReason: failureReason ?? "Failed by admin",
          },
        });
        await tx.notification.create({
          data: {
            userId: withdrawal.userId,
            type: "WITHDRAWAL_FAILED",
            title: "Withdrawal failed",
            body: `Your withdrawal of ₦${(withdrawal.amountKobo / 100).toLocaleString()} could not be completed and has been returned to your balance.`,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          actorId: null,
          action: action === "complete" ? "WITHDRAWAL_COMPLETED" : "WITHDRAWAL_FAILED",
          toValue: id,
          metadata: { via: "admin-console", failureReason },
        },
      });
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
