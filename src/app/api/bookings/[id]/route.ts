import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handleApiError, userError } from "@/lib/api-error";
import { transitionBooking } from "@/lib/booking-state-machine";
import { getSetting } from "@/lib/platform-settings";

const ActionSchema = z.object({
  action: z.enum(["check_in", "check_out", "complete", "cancel"]),
  accessCode: z.string().optional(), // required for check_in
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;

    const booking = await db.booking.findUnique({
      where: { id },
      include: {
        listing: { include: { media: true, location: true } },
        deposit: true,
        payout: true,
      },
    });
    if (!booking) throw userError("Booking not found.");
    if (booking.customerId !== user.id && booking.listing.providerId !== user.id && !user.isAdmin) {
      throw userError("Booking not found.");
    }

    return NextResponse.json(booking);
  } catch (err) {
    return handleApiError(err);
  }
}

/**
 * State-changing booking actions. Who can call which action is checked
 * explicitly below — this is deliberately NOT "any participant can do
 * anything," since e.g. only the provider should confirm check-in.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const body = ActionSchema.parse(await req.json());

    const booking = await db.booking.findUnique({
      where: { id },
      include: { listing: true },
    });
    if (!booking) throw userError("Booking not found.");

    const isCustomer = booking.customerId === user.id;
    const isProvider = booking.listing.providerId === user.id;
    if (!isCustomer && !isProvider && !user.isAdmin) {
      throw userError("Booking not found.");
    }

    if (body.action === "cancel") {
      if (!isCustomer && !user.isAdmin) throw userError("Only the customer can cancel this booking.");
      await db.$transaction(async (tx) => {
        await transitionBooking(tx, {
          bookingId: id,
          to: "CANCELLED",
          actorId: user.id,
          reason: "Cancelled by customer",
        });
        await tx.booking.update({ where: { id }, data: { cancelledAt: new Date() } });
        // NOTE: refund calculation against the listing's CancellationPolicy
        // (spec §30) is a Phase 1 TODO — this correctly moves the booking
        // out of the active calendar but does not yet compute/post a
        // partial-refund ledger entry. Flagged rather than faked.
      });
      return NextResponse.json({ status: "CANCELLED" });
    }

    if (body.action === "check_in") {
      if (!isProvider) throw userError("Only the provider can confirm check-in.");
      if (!body.accessCode || body.accessCode !== booking.accessCode) {
        throw userError("Access code does not match.");
      }
      await db.$transaction((tx) =>
        transitionBooking(tx, {
          bookingId: id,
          to: "CHECKED_IN",
          actorId: user.id,
        })
      );
      // Booking moves ACTIVE immediately once checked in — no separate
      // customer action required for Phase 1.
      await db.$transaction((tx) =>
        transitionBooking(tx, { bookingId: id, to: "ACTIVE", actorId: user.id })
      );
      return NextResponse.json({ status: "ACTIVE" });
    }

    if (body.action === "check_out") {
      if (!isProvider) throw userError("Only the provider can confirm check-out.");
      await db.$transaction((tx) =>
        transitionBooking(tx, { bookingId: id, to: "CHECKOUT_PENDING", actorId: user.id })
      );
      return NextResponse.json({ status: "CHECKOUT_PENDING" });
    }

    if (body.action === "complete") {
      if (!isProvider && !user.isAdmin) throw userError("Only the provider can mark this complete.");

      const payoutHoldDays = await getSetting<number>("payoutHoldDays");
      const availableAt = new Date(Date.now() + payoutHoldDays * 24 * 60 * 60 * 1000);

      await db.$transaction(async (tx) => {
        await transitionBooking(tx, { bookingId: id, to: "COMPLETED", actorId: user.id });
        await transitionBooking(tx, { bookingId: id, to: "PAYOUT_PENDING", actorId: user.id });

        await tx.payout.create({
          data: {
            bookingId: id,
            providerId: booking.listing.providerId,
            amountKobo: booking.bookingAmountKobo - booking.commissionAmountKobo,
            availableAt,
          },
        });

        await tx.booking.update({
          where: { id },
          data: { accessCode: null, accessCodeExpiresAt: null },
        });

        if (booking.depositAmountKobo > 0) {
          await tx.deposit.updateMany({
            where: { bookingId: id, status: "HELD" },
            data: { status: "REFUND_APPROVED" },
          });
          // NOTE: actual deposit refund transfer + REFUNDED ledger entry
          // is posted by a separate deposit-release job that gives the
          // provider their configured inspection window first (spec §48).
          // Not wired in this sandbox build.
        }

        await tx.notification.create({
          data: {
            userId: booking.listing.providerId,
            type: "PAYOUT_SCHEDULED",
            title: "Payout scheduled",
            body: `Your earnings for booking ${id} are scheduled for ${availableAt.toDateString()}.`,
          },
        });
      });

      return NextResponse.json({ status: "PAYOUT_PENDING", payoutAvailableAt: availableAt });
    }

    throw userError("Unknown action.");
  } catch (err) {
    return handleApiError(err);
  }
}
