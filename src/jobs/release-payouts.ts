import { db } from "@/lib/db";
import { transitionBooking } from "@/lib/booking-state-machine";
import { LedgerEntryStatus, LedgerEntryType } from "@prisma/client";

/**
 * Run on a schedule (e.g. every 15 minutes via Vercel Cron / any external
 * scheduler hitting a protected route that calls this — no queue infra
 * assumed for Phase 1, see ARCHITECTURE.md §8).
 *
 * For every Payout whose hold window has passed and which has no active
 * dispute hold, flips the provider's PROVIDER_EARNING_PENDING ledger
 * entries to PROVIDER_EARNING_AVAILABLE and moves the booking to
 * PAYOUT_RELEASED.
 */
export async function releaseDuePayouts(): Promise<{ released: number; skipped: number }> {
  const due = await db.payout.findMany({
    where: {
      releasedAt: null,
      holdReason: null,
      availableAt: { lte: new Date() },
    },
    include: { booking: true },
  });

  let released = 0;
  let skipped = 0;

  for (const payout of due) {
    try {
      await db.$transaction(async (tx) => {
        // Re-check inside the transaction in case a dispute was opened
        // between the query above and now.
        const fresh = await tx.payout.findUniqueOrThrow({ where: { id: payout.id } });
        if (fresh.releasedAt || fresh.holdReason) return;

        const pendingEntry = await tx.ledgerEntry.findFirst({
          where: {
            bookingId: payout.bookingId,
            type: LedgerEntryType.PROVIDER_EARNING_PENDING,
            status: LedgerEntryStatus.RESERVED,
          },
        });
        if (!pendingEntry) return;

        await tx.ledgerEntry.update({
          where: { id: pendingEntry.id },
          data: { status: LedgerEntryStatus.RELEASED },
        });

        await tx.ledgerEntry.create({
          data: {
            bookingId: payout.bookingId,
            userId: pendingEntry.userId,
            type: LedgerEntryType.PROVIDER_EARNING_AVAILABLE,
            direction: "CREDIT",
            amountKobo: pendingEntry.amountKobo,
            status: LedgerEntryStatus.AVAILABLE,
          },
        });

        await tx.payout.update({
          where: { id: payout.id },
          data: { releasedAt: new Date() },
        });

        await transitionBooking(tx, {
          bookingId: payout.bookingId,
          to: "PAYOUT_RELEASED",
          actorId: null,
          reason: "Payout hold window elapsed",
        });

        await tx.notification.create({
          data: {
            userId: pendingEntry.userId,
            type: "PAYOUT_RELEASED",
            title: "Funds available",
            body: `₦${(pendingEntry.amountKobo / 100).toLocaleString()} is now available to withdraw.`,
          },
        });
      });
      released++;
    } catch (err) {
      console.error(`Failed to release payout ${payout.id}:`, err);
      skipped++;
    }
  }

  return { released, skipped };
}

/**
 * Admin override: release a specific payout right now, regardless of its
 * `availableAt` hold window — and clears a dispute hold if present. Used
 * by the admin console's "release now" action (ARCHITECTURE.md §1 item
 * 10: "Admin: view transactions, disputes, override/release payouts").
 * Every use is written to AuditLog since it's a manual override of the
 * normal state machine.
 */
export async function forceReleasePayout(payoutId: string, reason: string): Promise<void> {
  await db.$transaction(async (tx) => {
    const payout = await tx.payout.findUniqueOrThrow({ where: { id: payoutId } });
    if (payout.releasedAt) throw new Error("Payout already released.");

    const pendingEntry = await tx.ledgerEntry.findFirst({
      where: {
        bookingId: payout.bookingId,
        type: LedgerEntryType.PROVIDER_EARNING_PENDING,
        status: LedgerEntryStatus.RESERVED,
      },
    });
    if (!pendingEntry) throw new Error("No pending earning entry found for this payout.");

    await tx.ledgerEntry.update({
      where: { id: pendingEntry.id },
      data: { status: LedgerEntryStatus.RELEASED },
    });

    await tx.ledgerEntry.create({
      data: {
        bookingId: payout.bookingId,
        userId: pendingEntry.userId,
        type: LedgerEntryType.PROVIDER_EARNING_AVAILABLE,
        direction: "CREDIT",
        amountKobo: pendingEntry.amountKobo,
        status: LedgerEntryStatus.AVAILABLE,
      },
    });

    await tx.payout.update({
      where: { id: payoutId },
      data: { releasedAt: new Date(), holdReason: null },
    });

    await transitionBooking(tx, {
      bookingId: payout.bookingId,
      to: "PAYOUT_RELEASED",
      actorId: null,
      reason: `Admin override: ${reason}`,
    }).catch(() => {
      // Booking may already be past PAYOUT_RELEASED in an edge case —
      // the ledger + payout rows above are the source of truth either way.
    });

    await tx.auditLog.create({
      data: {
        actorId: null,
        action: "PAYOUT_FORCE_RELEASED",
        toValue: payoutId,
        metadata: { via: "admin-console", reason },
      },
    });

    await tx.notification.create({
      data: {
        userId: pendingEntry.userId,
        type: "PAYOUT_RELEASED",
        title: "Funds available",
        body: `₦${(pendingEntry.amountKobo / 100).toLocaleString()} was released early by an admin and is now available to withdraw.`,
      },
    });
  });
}
