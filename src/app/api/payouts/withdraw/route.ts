import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireProvider } from "@/lib/auth";
import { handleApiError, userError } from "@/lib/api-error";
import { getProviderAvailableBalanceKobo } from "@/lib/ledger";
import { getSetting } from "@/lib/platform-settings";
import { sendWithdrawalAlertEmail } from "@/lib/email";
import { LedgerEntryStatus, LedgerEntryType } from "@prisma/client";

const WithdrawSchema = z.object({ amountKobo: z.number().int().positive() });

export async function POST(req: NextRequest) {
  try {
    const user = await requireProvider();
    const { amountKobo } = WithdrawSchema.parse(await req.json());

    const profile = await db.providerProfile.findUniqueOrThrow({ where: { userId: user.id } });

    if (!profile.payoutBankCode || !profile.payoutAccountNumber) {
      throw userError("Add a payout bank account before withdrawing.");
    }

    const minWithdrawalKobo = await getSetting<number>("minWithdrawalKobo");
    if (amountKobo < minWithdrawalKobo) {
      throw userError(`Minimum withdrawal is ₦${(minWithdrawalKobo / 100).toLocaleString()}.`);
    }

    // Payout-info changes get a cooling-off period before withdrawals are
    // allowed against the new account (spec §34).
    if (
      profile.payoutInfoUpdatedAt &&
      Date.now() - profile.payoutInfoUpdatedAt.getTime() < 24 * 60 * 60 * 1000
    ) {
      throw userError(
        "Your payout account was changed recently. For security, withdrawals are on hold for 24 hours."
      );
    }

    const openDispute = await db.dispute.findFirst({
      where: {
        booking: { listing: { providerId: user.id } },
        status: { in: ["OPEN", "UNDER_REVIEW", "WAITING_FOR_PROVIDER", "WAITING_FOR_CUSTOMER"] },
      },
    });
    // Note: this is a broad hold — Phase 2 should scope holds to only the
    // disputed booking's specific earnings rather than the whole balance.
    // Flagged deliberately conservative for Phase 1.
    if (openDispute) {
      throw userError("You have an open dispute. Withdrawals are paused until it's resolved.");
    }

    const available = await getProviderAvailableBalanceKobo(user.id);
    if (amountKobo > available) {
      throw userError(
        `You're trying to withdraw more than your available balance (₦${(available / 100).toLocaleString()}).`
      );
    }

    const withdrawal = await db.$transaction(async (tx) => {
      const w = await tx.withdrawal.create({
        data: {
          userId: user.id,
          amountKobo,
          status: "PENDING",
          source: "PROVIDER_EARNINGS",
          destinationBankCode: profile.payoutBankCode!,
          destinationAccountNumber: profile.payoutAccountNumber!,
          destinationAccountName: profile.payoutAccountName,
        },
      });

      await tx.ledgerEntry.create({
        data: {
          userId: user.id,
          type: LedgerEntryType.WITHDRAWAL_REQUESTED,
          direction: "DEBIT",
          amountKobo,
          status: LedgerEntryStatus.RESERVED,
        },
      });

      await tx.notification.create({
        data: {
          userId: user.id,
          type: "WITHDRAWAL_REQUESTED",
          title: "Withdrawal requested",
          body: `Your withdrawal request for ₦${(amountKobo / 100).toLocaleString()} has been received. This is processed manually right now and can take a few minutes to show as sent.`,
        },
      });

      return w;
    });

    // Runs after the transaction commits so the request itself always
    // succeeds even if the email fails — the withdrawal row is still
    // visible in /admin/withdrawals either way.
    await sendWithdrawalAlertEmail({
      userFullName: user.fullName,
      userEmail: user.email,
      amountKobo,
      bankCode: profile.payoutBankCode!,
      accountNumber: profile.payoutAccountNumber!,
      accountName: profile.payoutAccountName,
      source: "PROVIDER_EARNINGS",
    });

    // TODO(phase 1 wiring): call Paystack Transfer API here (or from a
    // background job that picks up PENDING withdrawals) to actually move
    // funds, then flip status PROCESSING → COMPLETED/FAILED based on the
    // transfer.success / transfer.failed webhook. Not wired in this
    // sandbox build — see ARCHITECTURE.md §8.

    return NextResponse.json({ id: withdrawal.id, status: withdrawal.status }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
