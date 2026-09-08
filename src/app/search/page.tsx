import Link from "next/link";
import { db } from "@/lib/db";
import { ListingStatus, Prisma } from "@prisma/client";

function formatNaira(kobo: number | null): string {
  if (kobo == null) return "Contact for price";
  return `₦${(kobo / 100).toLocaleString()}`;
}

const UNIT_LABEL: Record<string, string> = {
  HOURLY: "/hr",
  DAILY: "/day",
  WEEKLY: "/wk",
  MONTHLY: "/mo",
  PER_PERSON: "/person",
  PER_UNIT: "/unit",
  PER_SESSION: "/session",
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim();
  const category = sp.category;
  const city = sp.city;

  const where: Prisma.ListingWhereInput = { status: ListingStatus.ACTIVE };
  if (q) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
    ];
  }
  if (category) where.category = { slug: category };
  if (city) where.location = { city: { equals: city, mode: "insensitive" } };

  const listings = await db.listing.findMany({
    where,
    include: {
      category: true,
      location: true,
      media: { orderBy: { sortOrder: "asc" }, take: 1 },
      priceRules: { where: { appliesTo: "BASE" }, take: 1 },
      provider: { select: { fullName: true, verificationLevel: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 24,
  });

  const categories = await db.category.findMany({
    where: { parentId: null, isActive: true },
    orderBy: { sortOrder: "asc" },
  });

  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">
          {q ? `Results for "${q}"` : "Browse listings"}
        </h1>
        <p className="text-sm text-[var(--ink-soft)]">{listings.length} results</p>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {categories.map((c) => (
          <Link
            key={c.id}
            href={`/search?category=${c.slug}`}
            className={`px-3 py-1.5 rounded-full border text-sm transition-colors ${
              category === c.slug
                ? "bg-ink text-paper border-ink"
                : "border-[var(--line)] hover:border-brass"
            }`}
          >
            {c.name}
          </Link>
        ))}
      </div>

      {listings.length === 0 ? (
        <div className="mt-16 text-center text-[var(--ink-soft)]">
          <p>No listings match yet — this is a fresh install with no seeded listings.</p>
          <p className="text-sm mt-1">
            Providers can{" "}
            <Link href="/provider/listings/new" className="text-brass-dim hover:underline">
              create the first one
            </Link>
            .
          </p>
        </div>
      ) : (
        <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {listings.map((l) => (
            <Link
              key={l.id}
              href={`/listings/${l.id}`}
              className="rounded-xl border border-[var(--line)] overflow-hidden hover:border-brass transition-colors bg-[var(--paper-raised)]"
            >
              <div className="aspect-[4/3] bg-[var(--line)]" />
              <div className="p-4">
                <p className="font-medium leading-snug">{l.title}</p>
                <p className="text-sm text-[var(--ink-soft)] mt-0.5">
                  {l.location.area ? `${l.location.area}, ` : ""}
                  {l.location.city}
                </p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="font-mono text-sm">
                    {formatNaira(l.priceRules[0]?.amountKobo ?? null)}
                    <span className="text-[var(--ink-soft)]">
                      {l.priceRules[0] ? UNIT_LABEL[l.priceRules[0].unit] : ""}
                    </span>
                  </span>
                  {l.instantBook && (
                    <span className="text-xs bg-signal/15 text-signal px-2 py-0.5 rounded-full">
                      Instant book
                    </span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
