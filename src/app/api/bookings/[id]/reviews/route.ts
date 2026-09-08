import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handleApiError, userError } from "@/lib/api-error";

const ELIGIBLE_STATUSES = ["COMPLETED", "PAYOUT_PENDING", "PAYOUT_RELEASED"];

const ReviewSchema = z.object({
  overallRating: z.number().int().min(1).max(5),
  categoryRatings: z
    .object({
      accuracy: z.number().int().min(1).max(5).optional(),
      communication: z.number().int().min(1).max(5).optional(),
      condition: z.number().int().min(1).max(5).optional(),
      reliability: z.number().int().min(1).max(5).optional(),
      value: z.number().int().min(1).max(5).optional(),
    })
    .default({}),
  comment: z.string().trim().max(2000).optional(),
});

/**
 * POST /api/bookings/[id]/reviews — either party leaves one review per
 * booking, about the other party's listing/service. Only allowed once
 * the booking has actually happened (spec-aligned with the state
 * machine's terminal "it happened" states, not just "paid for").
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const body = ReviewSchema.parse(await req.json());

    const booking = await db.booking.findUnique({
      where: { id },
      include: { listing: { select: { id: true, providerId: true } } },
    });
    if (!booking) throw userError("Booking not found.");

    const isCustomer = booking.customerId === user.id;
    const isProvider = booking.listing.providerId === user.id;
    if (!isCustomer && !isProvider) throw userError("Booking not found.");

    if (!ELIGIBLE_STATUSES.includes(booking.status)) {
      throw userError("You can only leave a review after the booking is completed.");
    }

    const existing = await db.review.findUnique({
      where: { bookingId_authorId: { bookingId: id, authorId: user.id } },
    });
    if (existing) throw userError("You've already reviewed this booking.");

    const subjectId = isCustomer ? booking.listing.providerId : booking.customerId;

    const review = await db.$transaction(async (tx) => {
      const created = await tx.review.create({
        data: {
          bookingId: id,
          listingId: booking.listing.id,
          authorId: user.id,
          subjectId,
          overallRating: body.overallRating,
          categoryRatings: body.categoryRatings,
          comment: body.comment,
        },
      });

      await tx.notification.create({
        data: {
          userId: subjectId,
          type: "NEW_REVIEW",
          title: "You got a new review",
          body: body.comment
            ? `${body.overallRating}★ — ${body.comment.slice(0, 100)}`
            : `${body.overallRating}★ rating left on a completed booking.`,
        },
      });

      return created;
    });

    return NextResponse.json({ id: review.id }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
