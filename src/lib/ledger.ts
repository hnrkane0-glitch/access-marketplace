import { LedgerEntryStatus, LedgerEntryType, Prisma } from "@prisma/client";
import { db } from "@/lib/db";

/**
 * The platform's own "user" row for entries that don't belong to a
 * customer or provider (e.g. PLATFORM_COMMISSION). Seeded in
 * prisma/seed.ts. Looking this up by a well-known email keeps the schema
 * simple (LedgerEntry.userId is always a real User FK) without a nullable
 * special case throughout the codebase.
 */
export const PLATFORM_SYSTEM_USER_EMAIL = "platform@system.internal";

interface PostEntryInput {
  bookingId: string | null;
  userId: string;
  type: LedgerEntryType;
  direction: "CREDIT" | "DEBIT";
  amountKobo: number;
  status: LedgerEntryStatus;
  relatedPaymentEventId?: string;
}

/**
 * Posts one ledger row. Never call this outside a transaction that also
 * updates the Booking/Payment/Deposit rows it's describing — a ledger
 * entry that exists without its corresponding state change (or vice
 * versa) is exactly the kind of drift the reconciliation tooling in
 * ARCHITECTURE.md §4 exists to catch, so the goal is to never produce it
 * in the first place.
 */
export async function postLedgerEntry(
  tx: Prisma.TransactionClient,
  input: PostEntryInput
) {
  if (input.amountKobo <= 0) {
    throw new Error(`Ledger entries must be positive amounts, got ${input.amountKobo}`);
  }
  return tx.ledgerEntry.create({
    data: {
      bookingId: input.bookingId,
      userId: input.userId,
      type: input.type,
      direction: input.direction,
      amountKobo: input.amountKobo,
      status: input.status,
      relatedPaymentEventId: input.relatedPaymentEventId,
    },
  });
}

/**
 * Posts the full set of entries for a confirmed booking payment
 * (the worked example in ARCHITECTURE.md §4). Called once, from inside
 * the Paystack webhook handler's transaction, guarded by the
 * PaymentEvent uniqueness constraint so it can never run twice for the
 * same webhook delivery.
 */
export async function postBookingPaymentEntries(
  tx: Prisma.TransactionClient,
  params: {
    bookingId: string;
    customerId: string;
    providerId: string;
    bookingAmountKobo: number;
    depositAmountKobo: number;
    commissionAmountKobo: number;
    providerEarningKobo: number;
    paymentEventId: string;
  }
) {
  const platformUser = await tx.user.findUniqueOrThrow({
    where: { email: PLATFORM_SYSTEM_USER_EMAIL },
    select: { id: true },
  });

  await postLedgerEntry(tx, {
    bookingId: params.bookingId,
    userId: params.customerId,
    type: LedgerEntryType.BOOKING_PAYMENT,
    direction: "CREDIT",
    amountKobo: params.bookingAmountKobo,
    status: LedgerEntryStatus.RESERVED,
    relatedPaymentEventId: params.paymentEventId,
  });

  if (params.depositAmountKobo > 0) {
    await postLedgerEntry(tx, {
      bookingId: params.bookingId,
      userId: params.customerId,
      type: LedgerEntryType.DEPOSIT_HELD,
      direction: "CREDIT",
      amountKobo: params.depositAmountKobo,
      status: LedgerEntryStatus.RESERVED,
      relatedPaymentEventId: params.paymentEventId,
    });
  }

  await postLedgerEntry(tx, {
    bookingId: params.bookingId,
    userId: params.providerId,
    type: LedgerEntryType.GROSS_BOOKING_REVENUE,
    direction: "CREDIT",
    amountKobo: params.bookingAmountKobo,
    status: LedgerEntryStatus.RESERVED,
    relatedPaymentEventId: params.paymentEventId,
  });

  await postLedgerEntry(tx, {
    bookingId: params.bookingId,
    userId: platformUser.id,
    type: LedgerEntryType.PLATFORM_COMMISSION,
    direction: "CREDIT",
    amountKobo: params.commissionAmountKobo,
    status: LedgerEntryStatus.AVAILABLE,
    relatedPaymentEventId: params.paymentEventId,
  });

  await postLedgerEntry(tx, {
    bookingId: params.bookingId,
    userId: params.providerId,
    type: LedgerEntryType.PROVIDER_EARNING_PENDING,
    direction: "CREDIT",
    amountKobo: params.providerEarningKobo,
    status: LedgerEntryStatus.RESERVED,
    relatedPaymentEventId: params.paymentEventId,
  });
}

/**
 * Provider's withdrawable balance, computed live from ledger rows —
 * never stored. This is what /api/payouts and the provider dashboard
 * must call; nothing should read a cached "balance" field anywhere.
 */
export async function getProviderAvailableBalanceKobo(providerId: string): Promise<number> {
  const [available, withdrawn] = await Promise.all([
    db.ledgerEntry.aggregate({
      where: {
        userId: providerId,
        type: LedgerEntryType.PROVIDER_EARNING_AVAILABLE,
        status: LedgerEntryStatus.AVAILABLE,
      },
      _sum: { amountKobo: true },
    }),
    db.ledgerEntry.aggregate({
      where: {
        userId: providerId,
        type: LedgerEntryType.WITHDRAWAL_REQUESTED,
        status: { in: [LedgerEntryStatus.PENDING, LedgerEntryStatus.RESERVED] },
      },
      _sum: { amountKobo: true },
    }),
  ]);

  return (available._sum.amountKobo ?? 0) - (withdrawn._sum.amountKobo ?? 0);
}

export async function getProviderPendingBalanceKobo(providerId: string): Promise<number> {
  const pending = await db.ledgerEntry.aggregate({
    where: {
      userId: providerId,
      type: LedgerEntryType.PROVIDER_EARNING_PENDING,
      status: LedgerEntryStatus.RESERVED,
    },
    _sum: { amountKobo: true },
  });
  return pending._sum.amountKobo ?? 0;
}

export async function getCustomerReservedDepositsKobo(customerId: string): Promise<number> {
  const held = await db.ledgerEntry.aggregate({
    where: {
      userId: customerId,
      type: LedgerEntryType.DEPOSIT_HELD,
      status: LedgerEntryStatus.RESERVED,
    },
    _sum: { amountKobo: true },
  });
  return held._sum.amountKobo ?? 0;
}
