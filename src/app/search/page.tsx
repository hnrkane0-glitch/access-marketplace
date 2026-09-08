import Link from "next/link";
import { db } from "@/lib/db";
import { ListingStatus, Prisma } from "@prisma/client";
import { Zap, ImageOff, MapPin, PlusCircle, Search as SearchIcon } from "lucide-react";
import { CATEGORY_ICON, CATEGORY_TINT } from "@/lib/category-visuals";

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
  const instantOnly = sp.instantBook === "true";

  const where: Prisma.ListingWhereInput = { status: ListingStatus.ACTIVE };
  if (q) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
    ];
  }
  if (category) where.category = { slug: category };
  if (city) where.location = { city: { equals: city, mode: "insensitive" } };
  if (instantOnly) where.instantBook = true;

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
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <SearchIcon size={22} className="text-brass" />
          {q ? `Results for "${q}"` : instantOnly ? "Available right now" : "Browse listings"}
        </h1>
        <p className="text-sm text-[var(--ink-soft)]">{listings.length} results</p>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <Link
          href="/search"
          className={`px-3 py-1.5 rounded-full border text-sm font-medium transition-colors ${
            !category ? "bg-grad-brand text-white border-transparent" : "border-[var(--line)] hover:border-brass"
          }`}
        >
          All
        </Link>
        {categories.map((c) => {
          const Icon = CATEGORY_ICON[c.slug] ?? SearchIcon;
          return (
            <Link
              key={c.id}
              href={`/search?category=${c.slug}`}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-medium transition-colors ${
                category === c.slug
                  ? "bg-grad-brand text-white border-transparent"
                  : "border-[var(--line)] hover:border-brass"
              }`}
            >
              <Icon size={14} />
              {c.name}
            </Link>
          );
        })}
      </div>

      {listings.length === 0 ? (
        <div className="mt-16 text-center text-[var(--ink-soft)] rounded-2xl border border-dashed border-[var(--line)] py-16 bg-[var(--paper-raised)]">
          <ImageOff size={28} className="mx-auto text-[var(--ink-soft)]" />
          <p className="mt-3">No listings match yet — this is a fresh install with no seeded listings.</p>
          <p className="text-sm mt-1 flex items-center justify-center gap-1.5">
            Providers can{" "}
            <Link href="/provider/listings/new" className="text-brass font-medium hover:underline flex items-center gap-1">
              <PlusCircle size={14} /> create the first one
            </Link>
            .
          </p>
        </div>
      ) : (
        <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {listings.map((l) => {
            const thumb = l.media[0]?.url;
            const Icon = CATEGORY_ICON[l.category.slug] ?? SearchIcon;
            const tint = CATEGORY_TINT[l.category.slug] ?? "from-violet-500 to-indigo-500";
            return (
              <Link
                key={l.id}
                href={`/listings/${l.id}`}
                className="group rounded-2xl border border-[var(--line)] overflow-hidden hover:border-brass card-shadow hover-lift bg-[var(--paper-raised)]"
              >
                <div className="relative aspect-[4/3] overflow-hidden">
                  {thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element -- provider-supplied URLs on arbitrary hosts, not worth an allowlist
                    <img
                      src={thumb}
                      alt={l.title}
                      className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className={`w-full h-full bg-gradient-to-br ${tint} flex items-center justify-center`}>
                      <Icon size={36} className="text-white/90" />
                    </div>
                  )}
                  {l.instantBook && (
                    <span className="absolute top-2.5 left-2.5 text-xs bg-white/95 text-emerald-700 font-medium px-2.5 py-1 rounded-full flex items-center gap-1 shadow-sm">
                      <Zap size={11} fill="currentColor" /> Instant book
                    </span>
                  )}
                </div>
                <div className="p-4">
                  <p className="font-medium leading-snug">{l.title}</p>
                  <p className="text-sm text-[var(--ink-soft)] mt-0.5 flex items-center gap-1">
                    <MapPin size={13} />
                    {l.location.area ? `${l.location.area}, ` : ""}
                    {l.location.city}
                  </p>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="font-mono text-sm font-semibold">
                      {formatNaira(l.priceRules[0]?.amountKobo ?? null)}
                      <span className="text-[var(--ink-soft)] font-normal">
                        {l.priceRules[0] ? UNIT_LABEL[l.priceRules[0].unit] : ""}
                      </span>
                    </span>
                    <span className="text-xs text-[var(--ink-soft)]">{l.category.name}</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
