import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdminSession } from "@/lib/admin-auth";
import { handleApiError } from "@/lib/api-error";
import { ListingStatus } from "@prisma/client";

/**
 * GET /api/admin/listings — admin queue of listings by status.
 *
 * This is the piece that was previously missing entirely: providers
 * create listings as PENDING_REVIEW (see POST /api/listings), and
 * nothing in the app ever moved them to ACTIVE, so nothing a provider
 * posted could ever show up in search or on their public listing page.
 * Default view is the review queue (PENDING_REVIEW).
 */
export async function GET(req: NextRequest) {
  try {
    await requireAdminSession();
    const sp = req.nextUrl.searchParams;
    const statusParam = sp.get("status")?.toUpperCase();
    const status =
      statusParam && statusParam in ListingStatus
        ? (statusParam as ListingStatus)
        : ListingStatus.PENDING_REVIEW;

    const listings = await db.listing.findMany({
      where: { status },
      include: {
        category: true,
        location: true,
        media: { orderBy: { sortOrder: "asc" }, take: 1 },
        priceRules: { where: { appliesTo: "BASE" }, take: 1 },
        provider: { select: { id: true, fullName: true, email: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({
      status,
      results: listings.map((l) => ({
        id: l.id,
        title: l.title,
        description: l.description,
        category: l.category.name,
        city: l.location.city,
        area: l.location.area,
        provider: l.provider,
        thumbnail: l.media[0]?.url ?? null,
        basePriceKobo: l.priceRules[0]?.amountKobo ?? null,
        priceUnit: l.priceRules[0]?.unit ?? null,
        createdAt: l.createdAt,
      })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}
