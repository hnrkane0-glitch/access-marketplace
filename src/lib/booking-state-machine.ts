import { BookingStatus, Prisma, PrismaClient } from "@prisma/client";

/**
 * Whitelist of allowed transitions. Any transition not listed here is a
 * bug, not a business decision — `transitionBooking` throws rather than
 * silently allowing it. This is deliberately more restrictive than the
 * diagram in ARCHITECTURE.md would suggest at a glance, because several
 * "side branch" states (CANCELLED, DISPUTED, REFUND_PENDING) are reachable
 * from more than one source state.
 */
const ALLOWED_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  REQUESTED: ["PAYMENT_PENDING", "CANCELLED"],
  PAYMENT_PENDING: ["PAID", "PAYMENT_FAILED", "CANCELLED"],
  PAID: ["CONFIRMED", "REFUND_PENDING"],
  CONFIRMED: ["CHECKED_IN", "CANCELLED", "DISPUTED"],
  CHECKED_IN: ["ACTIVE", "DISPUTED"],
  ACTIVE: ["CHECKOUT_PENDING", "DISPUTED"],
  CHECKOUT_PENDING: ["COMPLETED", "DISPUTED"],
  COMPLETED: ["PAYOUT_PENDING", "DISPUTED"],
  PAYOUT_PENDING: ["PAYOUT_RELEASED", "DISPUTED"],
  PAYOUT_RELEASED: [],
  CANCELLED: [],
  REFUND_PENDING: ["REFUNDED"],
  REFUNDED: [],
  DISPUTED: ["UNDER_REVIEW"],
  UNDER_REVIEW: ["CONFIRMED", "CHECKED_IN", "ACTIVE", "COMPLETED", "REFUND_PENDING", "SUSPENDED"],
  SUSPENDED: ["UNDER_REVIEW", "CANCELLED", "REFUND_PENDING"],
  PAYMENT_FAILED: [],
};

export class InvalidTransitionError extends Error {
  constructor(from: BookingStatus, to: BookingStatus) {
    super(`Booking cannot move from ${from} to ${to}.`);
  }
}

/**
 * Moves a booking from its current status to `to`, inside the caller's
 * transaction, and writes an AuditLog row. Callers pass a Prisma
 * transaction client (`tx`) so this always participates in the same
 * atomic operation as any ledger writes it's paired with — a booking
 * should never change status without its ledger consequences committing
 * together.
 */
export async function transitionBooking(
  tx: Prisma.TransactionClient,
  params: {
    bookingId: string;
    to: BookingStatus;
    actorId: string | null; // null = system/background job
    reason?: string;
  }
): Promise<void> {
  const booking = await tx.booking.findUniqueOrThrow({
    where: { id: params.bookingId },
    select: { status: true },
  });

  const allowed = ALLOWED_TRANSITIONS[booking.status] ?? [];
  if (!allowed.includes(params.to)) {
    throw new InvalidTransitionError(booking.status, params.to);
  }

  await tx.booking.update({
    where: { id: params.bookingId },
    data: { status: params.to },
  });

  await tx.auditLog.create({
    data: {
      actorId: params.actorId,
      bookingId: params.bookingId,
      action: "BOOKING_STATUS_TRANSITION",
      fromValue: booking.status,
      toValue: params.to,
      metadata: params.reason ? { reason: params.reason } : Prisma.JsonNull,
    },
  });
}
