import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handleApiError, userError } from "@/lib/api-error";

async function loadAuthorizedBooking(id: string, userId: string, isAdmin: boolean) {
  const booking = await db.booking.findUnique({
    where: { id },
    include: { listing: { select: { providerId: true, title: true } } },
  });
  if (!booking) throw userError("Booking not found.");
  const isCustomer = booking.customerId === userId;
  const isProvider = booking.listing.providerId === userId;
  if (!isCustomer && !isProvider && !isAdmin) throw userError("Booking not found.");
  return { booking, isCustomer, isProvider };
}

/** GET /api/bookings/[id]/messages — thread for this booking, oldest first. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    await loadAuthorizedBooking(id, user.id, user.isAdmin);

    const messages = await db.message.findMany({
      where: { bookingId: id },
      include: { sender: { select: { id: true, fullName: true } } },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({
      results: messages.map((m) => ({
        id: m.id,
        body: m.body,
        imageUrl: m.imageUrl,
        isSystem: m.isSystem,
        createdAt: m.createdAt,
        sender: m.sender,
        isMine: m.senderId === user.id,
      })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}

const SendMessageSchema = z.object({
  body: z.string().trim().min(1).max(2000),
  imageUrl: z.string().url().optional(),
});

/** POST /api/bookings/[id]/messages — send a message; notifies the other party. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const { booking, isCustomer } = await loadAuthorizedBooking(id, user.id, user.isAdmin);
    const { body, imageUrl } = SendMessageSchema.parse(await req.json());

    const recipientId = isCustomer ? booking.listing.providerId : booking.customerId;

    const message = await db.$transaction(async (tx) => {
      const created = await tx.message.create({
        data: { bookingId: id, senderId: user.id, body, imageUrl },
      });
      // Don't notify yourself if somehow customer === provider (shouldn't
      // happen, but cheap to guard) or if the recipient is the platform.
      if (recipientId && recipientId !== user.id) {
        await tx.notification.create({
          data: {
            userId: recipientId,
            type: "NEW_MESSAGE",
            title: `New message about "${booking.listing.title}"`,
            body: body.length > 140 ? `${body.slice(0, 140)}…` : body,
          },
        });
      }
      return created;
    });

    return NextResponse.json({ id: message.id, createdAt: message.createdAt }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
