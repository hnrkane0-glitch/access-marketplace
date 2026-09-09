import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handleApiError, userError } from "@/lib/api-error";
import { getWalletAvailableBalanceKobo } from "@/lib/ledger";
import { getSetting } from "@/lib/platform-settings";
import { LedgerEntryStatus, LedgerEntryType } from "@prisma/client";
import { sendAdminEmail, nairaEmail } from "@/lib/email";

const Schema = z.object({
  amountKobo: z.number().int().positive(),
  bankName: z.string().min(2).max(120),
  bankCode: z.string().min(2).max(30),
  accountName: z.string().min(2).max(120),
  accountNumber: z.string().regex(/^\d{10}$/, "Account number must be 10 digits."),
});

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = Schema.parse(await req.json());

    const minWithdrawalKobo = await getSetting<number>("minWithdrawalKobo");
    if (body.amountKobo < minWithdrawalKobo) {
      throw userError(`Minimum withdrawal is ₦${(minWithdrawalKobo / 100).toLocaleString()}.`);
    }

    const available = await getWalletAvailableBalanceKobo(user.id);
    if (body.amountKobo > available) {
      throw userError(`Your available balance is ₦${(available / 100).toLocaleString()}.`);
    }

    const withdrawal = await db.$transaction(async (tx) => {
      const w = await tx.withdrawal.create({
        data: {
          userId: user.id,
          amountKobo: body.amountKobo,
          status: "PENDING",
          destinationBankCode: body.bankCode,
          destinationBankName: body.bankName,
          destinationAccountNumber: body.accountNumber,
          destinationAccountName: body.accountName,
        },
      });

      await tx.ledgerEntry.create({
        data: {
          userId: user.id,
          type: LedgerEntryType.WITHDRAWAL_REQUESTED,
          direction: "DEBIT",
          amountKobo: body.amountKobo,
          status: LedgerEntryStatus.RESERVED,
        },
      });

      await tx.notification.create({
        data: {
          userId: user.id,
          type: "WITHDRAWAL_REQUESTED",
          title: "Withdrawal pending",
          body: `Your ${nairaEmail(body.amountKobo)} withdrawal request was received. Manual processing may take a few minutes.`,
        },
      });
      return w;
    });

    await sendAdminEmail(
      `Pending withdrawal — ${nairaEmail(body.amountKobo)}`,
      `<h2>Manual withdrawal requested</h2>
       <p><strong>${user.fullName}</strong> (${user.email}) requested <strong>${nairaEmail(body.amountKobo)}</strong>.</p>
       <h3>Bank details</h3>
       <p>Bank: <strong>${body.bankName}</strong><br>
       Bank code: <strong>${body.bankCode}</strong><br>
       Account name: <strong>${body.accountName}</strong><br>
       Account number: <strong>${body.accountNumber}</strong></p>
       <p>Open Admin → Withdrawals, send the money manually through Paystack, then mark the request as sent.</p>`
    );

    return NextResponse.json({ id: withdrawal.id, status: withdrawal.status }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
