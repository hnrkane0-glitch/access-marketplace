import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handleApiError, userError } from "@/lib/api-error";
import { getWalletBalanceKobo } from "@/lib/ledger";
import { sendWithdrawalAlertEmail } from "@/lib/email";
import { LedgerEntryStatus, LedgerEntryType } from "@prisma/client";

const WithdrawSchema = z.object({
  amountKobo: z.number().int().positive(),
  bankCode: z.string().min(1).max(20),
  bankName: z.string().min(1).max(120),
  accountNumber: z.string().min(6).max(20),
  accountName: z.string().min(1).max(200),
});

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const { amountKobo, bankCode, bankName, accountNumber, accountName } = WithdrawSchema.parse(
      await req.json()
    );

    const available = await getWalletBalanceKobo(user.id);
    if (amountKobo > available) {
      throw userError(
        `You're trying to withdraw more than your wallet balance (₦${(available / 100).toLocaleString()}).`
      );
    }

    const withdrawal = await db.$transaction(async (tx) => {
      const w = await tx.withdrawal.create({
        data: {
          userId: user.id,
          amountKobo,
          status: "PENDING",
          source: "WALLET",
          destinationBankCode: bankCode,
          destinationBankName: bankName,
          destinationAccountNumber: accountNumber,
          destinationAccountName: accountName,
        },
      });

      await tx.ledgerEntry.create({
        data: {
          userId: user.id,
          type: LedgerEntryType.WALLET_WITHDRAWAL_REQUESTED,
          direction: "DEBIT",
          amountKobo,
          status: LedgerEntryStatus.RESERVED,
        },
      });

      await tx.notification.create({
        data: {
          userId: user.id,
          type: "WALLET_WITHDRAWAL_REQUESTED",
          title: "Withdrawal requested",
          body: `Your withdrawal request for ₦${(amountKobo / 100).toLocaleString()} has been received. This is processed manually and can take a few minutes to show as sent.`,
        },
      });

      return w;
    });

    // This is a real payout of the platform's own money — a failed alert
    // email must never silently mean nobody finds out. Runs after the
    // transaction commits so the request itself always succeeds; the
    // withdrawal row is still visible in /admin/withdrawals either way.
    await sendWithdrawalAlertEmail({
      userFullName: user.fullName,
      userEmail: user.email,
      amountKobo,
      bankName,
      bankCode,
      accountNumber,
      accountName,
      source: "WALLET",
    });

    return NextResponse.json({ id: withdrawal.id, status: withdrawal.status }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
