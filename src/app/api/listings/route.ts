import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireProvider } from "@/lib/auth";
import { handleApiError, userError } from "@/lib/api-error";
import { ListingStatus, Prisma } from "@prisma/client";

/**
 * GET /api/listings — search + filter (spec §13, §16).
 *
 * Deliberately query-param driven (not a POST body) so results are
 * linkable/shareable and cacheable at the edge later. Category-specific
 * attribute filters arrive as `attr.<key>=<value>` and are matched
 * against Listing.attributeValues (a JSON column) — this is what lets
 * filters differ per category without a schema migration per category
 * (see CategoryAttribute in the Prisma schema).
 */
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const q = sp.get("q")?.trim();
    const categorySlug = sp.get("category");
    const city = sp.get("city");
    const minPriceKobo = sp.get("minPrice") ? Number(sp.get("minPrice")) : undefined;
    const maxPriceKobo = sp.get("maxPrice") ? Number(sp.get("maxPrice")) : undefined;
    const instantBook = sp.get("instantBook") === "true";
    const page = Math.max(1, Number(sp.get("page") ?? "1"));
    const pageSize = Math.min(50, Math.max(1, Number(sp.get("pageSize") ?? "20")));

    const where: Prisma.ListingWhereInput = {
      status: ListingStatus.ACTIVE,
    };

    if (q) {
      where.OR = [
        { title: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
      ];
    }
    if (categorySlug) {
      where.category = { slug: categorySlug };
    }
    if (city) {
      where.location = { city: { equals: city, mode: "insensitive" } };
    }
    if (instantBook) {
      where.instantBook = true;
    }

    // Category-specific attribute filters, e.g. ?attr.capacity=10
    for (const [key, value] of sp.entries()) {
      if (!key.startsWith("attr.")) continue;
      const attrKey = key.slice("attr.".length);
      where.attributeValues = {
        ...(typeof where.attributeValues === "object" ? where.attributeValues : {}),
        path: [attrKey],
        equals: value,
      } as Prisma.JsonFilter;
    }

    const [listings, total] = await db.$transaction([
      db.listing.findMany({
        where,
        include: {
          category: true,
          location: true,
          media: { orderBy: { sortOrder: "asc" }, take: 3 },
          priceRules: { where: { appliesTo: "BASE" }, take: 1 },
          depositRule: true,
          provider: { select: { id: true, fullName: true, verificationLevel: true } },
        },
        // NOTE: min/max price filtering happens in-memory below since price
        // lives in a related table with unit-dependent amounts; for scale,
        // this should become a materialized `basePriceKobo` column on
        // Listing with a real DB-level range filter. Flagged as a
        // performance TODO — spec §68 (don't load thousands of listings).
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.listing.count({ where }),
    ]);

    const filtered = listings.filter((l) => {
      const base = l.priceRules[0]?.amountKobo;
      if (base == null) return true;
      if (minPriceKobo != null && base < minPriceKobo) return false;
      if (maxPriceKobo != null && base > maxPriceKobo) return false;
      return true;
    });

    return NextResponse.json({
      results: filtered.map((l) => ({
        id: l.id,
        title: l.title,
        category: l.category.name,
        city: l.location.city,
        area: l.location.area,
        instantBook: l.instantBook,
        provider: l.provider,
        basePriceKobo: l.priceRules[0]?.amountKobo ?? null,
        priceUnit: l.priceRules[0]?.unit ?? null,
        depositMode: l.depositRule?.mode ?? "NONE",
        thumbnail: l.media[0]?.url ?? null,
        // exactAddress deliberately excluded — spec §17: don't expose
        // exact private address before the appropriate booking stage.
      })),
      page,
      pageSize,
      total,
    });
  } catch (err) {
    return handleApiError(err);
  }
}

const CreateListingSchema = z.object({
  categoryId: z.string(),
  locationId: z.string(),
  title: z.string().min(5),
  description: z.string().min(20),
  instantBook: z.boolean().default(false),
  attributeValues: z.record(z.string(), z.unknown()).default({}),
  minBookingMinutes: z.number().int().min(15).default(60),
  maxBookingMinutes: z.number().int().min(15).nullable().default(null),
  exactAddress: z.string().optional(),
  basePrice: z.object({
    unit: z.enum(["HOURLY", "DAILY", "WEEKLY", "MONTHLY", "PER_PERSON", "PER_UNIT", "PER_SESSION"]),
    amountKobo: z.number().int().positive(),
  }),
  deposit: z
    .object({
      mode: z.enum(["NONE", "FIXED", "PERCENT"]),
      fixedKobo: z.number().int().positive().optional(),
      percentBps: z.number().int().min(0).max(10000).optional(),
    })
    .default({ mode: "NONE" }),
});

/** POST /api/listings — provider creates a new (draft) listing. */
export async function POST(req: NextRequest) {
  try {
    const user = await requireProvider();
    const body = CreateListingSchema.parse(await req.json());

    const category = await db.category.findUnique({ where: { id: body.categoryId } });
    if (!category || !category.isActive) {
      throw userError("Selected category is not available.");
    }

    const listing = await db.$transaction(async (tx) => {
      const created = await tx.listing.create({
        data: {
          providerId: user.id,
          categoryId: body.categoryId,
          locationId: body.locationId,
          title: body.title,
          description: body.description,
          instantBook: body.instantBook,
          attributeValues: body.attributeValues as Prisma.InputJsonValue,
          minBookingMinutes: body.minBookingMinutes,
          maxBookingMinutes: body.maxBookingMinutes,
          exactAddress: body.exactAddress,
          status: ListingStatus.PENDING_REVIEW,
          priceRules: {
            create: {
              unit: body.basePrice.unit,
              amountKobo: body.basePrice.amountKobo,
              appliesTo: "BASE",
            },
          },
          depositRule:
            body.deposit.mode === "NONE"
              ? undefined
              : {
                  create: {
                    mode: body.deposit.mode,
                    fixedKobo: body.deposit.fixedKobo,
                    percentBps: body.deposit.percentBps,
                  },
                },
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: "LISTING_CREATED",
          toValue: created.id,
        },
      });

      return created;
    });

    return NextResponse.json({ id: listing.id, status: listing.status }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}
