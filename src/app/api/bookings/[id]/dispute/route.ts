import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handleApiError, userError } from "@/lib/api-error";
import { transitionBooking } from "@/lib/booking-state-machine";

const DisputeSchema = z.object({
  reason: z.string().min(3),
  description: z.string().min(10),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const body = DisputeSchema.parse(await req.json());

    const booking = await db.booking.findUnique({ where: { id }, include: { listing: true, payout: true } });
    if (!booking) throw userError("Booking not found.");
    if (booking.customerId !== user.id && booking.listing.providerId !== user.id) {
      throw userError("Booking not found.");
    }

    const dispute = await db.$transaction(async (tx) => {
      const created = await tx.dispute.create({
        data: {
          bookingId: id,
          filedById: user.id,
          reason: body.reason,
          description: body.description,
          status: "OPEN",
        },
      });

      // Freeze payout release regardless of where the booking is in its
      // lifecycle — ARCHITECTURE.md §3.
      if (booking.payout && !booking.payout.releasedAt) {
        await tx.payout.update({
          where: { bookingId: id },
          data: { holdReason: "DISPUTE" },
        });
      }
      if (booking.depositAmountKobo > 0) {
        await tx.deposit.updateMany({
          where: { bookingId: id },
          data: { status: "UNDER_REVIEW" },
        });
      }

      // DISPUTED is reachable from several states per the state machine;
      // only attempt the transition if the booking isn't already terminal.
      if (!["CANCELLED", "REFUNDED", "PAYOUT_RELEASED"].includes(booking.status)) {
        await transitionBooking(tx, {
          bookingId: id,
          to: "DISPUTED",
          actorId: user.id,
          reason: body.reason,
        });
      }

      return created;
    });

    return NextResponse.json({ id: dispute.id, status: dispute.status }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
