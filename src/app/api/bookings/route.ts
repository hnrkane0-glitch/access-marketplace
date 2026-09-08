import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handleApiError, userError } from "@/lib/api-error";
import { computeBookingPrice } from "@/lib/pricing";
import { transitionBooking } from "@/lib/booking-state-machine";
import { BookingStatus, Prisma } from "@prisma/client";

const CreateBookingSchema = z.object({
  listingId: z.string(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  quantity: z.number().int().positive().default(1),
});

// Booking statuses that hold a real claim on the calendar.
const BLOCKING_STATUSES: BookingStatus[] = [
  "PAYMENT_PENDING",
  "PAID",
  "CONFIRMED",
  "CHECKED_IN",
  "ACTIVE",
  "CHECKOUT_PENDING",
];

/**
 * POST /api/bookings — the ONLY place a booking's price is computed.
 * The client sends listingId + time window + quantity. Nothing else.
 * See ARCHITECTURE.md §2 and §6.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = CreateBookingSchema.parse(await req.json());

    const startsAt = new Date(body.startsAt);
    const endsAt = new Date(body.endsAt);
    if (startsAt < new Date()) {
      throw userError("Booking start time must be in the future.");
    }

    const listing = await db.listing.findUnique({
      where: { id: body.listingId },
      include: {
        priceRules: true,
        depositRule: true,
        provider: { include: { providerProfile: true } },
      },
    });
    if (!listing || listing.status !== "ACTIVE") {
      throw userError("This listing is not currently bookable.");
    }
    if (listing.providerId === user.id) {
      throw userError("You can't book your own listing.");
    }

    const price = await computeBookingPrice({
      listing,
      providerCommissionOverrideBps: listing.provider.providerProfile?.commissionOverride ?? null,
      startsAt,
      endsAt,
      quantity: body.quantity,
    });

    // Application-layer double-booking guard, inside a transaction.
    // See ARCHITECTURE.md §6 — the real guarantee is a DB exclusion
    // constraint added via raw migration once `prisma migrate` can run
    // against a real database; this check narrows the race window
    // significantly in the meantime and is the correct check to keep
    // even after the constraint exists, since it gives a clean user-facing
    // error instead of a raw DB constraint violation.
    const booking = await db.$transaction(async (tx) => {
      const overlapping = await tx.booking.findFirst({
        where: {
          listingId: body.listingId,
          status: { in: BLOCKING_STATUSES },
          AND: [{ startsAt: { lt: endsAt } }, { endsAt: { gt: startsAt } }],
        },
      });
      if (overlapping) {
        throw userError("This time slot is no longer available.");
      }

      const created = await tx.booking.create({
        data: {
          listingId: body.listingId,
          customerId: user.id,
          startsAt,
          endsAt,
          quantity: body.quantity,
          status: "REQUESTED",
          priceSnapshot: price as unknown as Prisma.InputJsonValue,
          bookingAmountKobo: price.bookingAmountKobo,
          depositAmountKobo: price.depositAmountKobo,
          commissionAmountKobo: price.commissionAmountKobo,
          totalAmountKobo: price.totalAmountKobo,
        },
      });

      await transitionBooking(tx, {
        bookingId: created.id,
        to: "PAYMENT_PENDING",
        actorId: user.id,
        reason: "Booking created, awaiting payment",
      });

      return created;
    });

    return NextResponse.json(
      {
        id: booking.id,
        status: "PAYMENT_PENDING",
        bookingAmountKobo: price.bookingAmountKobo,
        depositAmountKobo: price.depositAmountKobo,
        totalAmountKobo: price.totalAmountKobo,
        breakdown: price.breakdown,
      },
      { status: 201 }
    );
  } catch (err) {
    return handleApiError(err);
  }
}
