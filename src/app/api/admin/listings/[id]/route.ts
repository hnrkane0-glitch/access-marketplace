import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { handleApiError, userError } from "@/lib/api-error";
import { ListingStatus } from "@prisma/client";

/**
 * Admin decisions a listing can move through from the review queue.
 * We reuse the existing ListingStatus enum rather than adding a new
 * REJECTED value (that would need a schema migration): a rejection is
 * recorded as DRAFT (sent back to the provider to edit and resubmit)
 * plus an AuditLog row carrying the reason, and SUSPENDED lets an
 * admin pull an already-ACTIVE listing back out of search.
 */
const DecisionSchema = z.object({
  action: z.enum(["approve", "reject", "suspend"]),
  reason: z.string().max(500).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const { action, reason } = DecisionSchema.parse(await req.json());

    const listing = await db.listing.findUnique({ where: { id } });
    if (!listing) throw userError("Listing not found.");

    const nextStatus: ListingStatus =
      action === "approve"
        ? ListingStatus.ACTIVE
        : action === "reject"
        ? ListingStatus.DRAFT
        : ListingStatus.SUSPENDED;

    const updated = await db.$transaction(async (tx) => {
      const result = await tx.listing.update({
        where: { id },
        data: { status: nextStatus },
      });

      await tx.auditLog.create({
        data: {
          actorId: admin.id,
          action: `LISTING_${action.toUpperCase()}`,
          fromValue: listing.status,
          toValue: nextStatus,
          metadata: reason ? { reason } : undefined,
        },
      });

      await tx.notification.create({
        data: {
          userId: listing.providerId,
          type: `LISTING_${action.toUpperCase()}`,
          title:
            action === "approve"
              ? "Your listing is live"
              : action === "reject"
              ? "Your listing needs changes"
              : "Your listing was suspended",
          body:
            action === "approve"
              ? `"${listing.title}" is now visible in search.`
              : reason ?? `"${listing.title}" was ${action}ed by an admin.`,
        },
      });

      return result;
    });

    return NextResponse.json({ id: updated.id, status: updated.status });
  } catch (err) {
    return handleApiError(err);
  }
}
