import { db } from "@/lib/db";
import ListingReviewQueue from "./review-queue";

// Auth is enforced one level up in src/app/admin/layout.tsx — every route
// nested under /admin already requires a valid admin-console session.

function naira(kobo: number | null): string {
  if (kobo == null) return "—";
  return `₦${(kobo / 100).toLocaleString()}`;
}

export default async function AdminListingsPage() {
  const pending = await db.listing.findMany({
    where: { status: "PENDING_REVIEW" },
    include: {
      category: true,
      location: true,
      media: { orderBy: { sortOrder: "asc" }, take: 1 },
      priceRules: { where: { appliesTo: "BASE" }, take: 1 },
      provider: { select: { id: true, fullName: true, email: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-semibold tracking-tight">Pending reviews</h1>
      <p className="mt-1 text-sm text-white/50">
        Providers submit listings as &quot;pending review&quot;. Nothing appears in
        search until you approve it here — this is the ONLY gate before a
        listing goes live.
      </p>

      <ListingReviewQueue
        initialListings={pending.map((l) => ({
          id: l.id,
          title: l.title,
          description: l.description,
          category: l.category.name,
          city: l.location.city,
          area: l.location.area,
          provider: l.provider,
          thumbnail: l.media[0]?.url ?? null,
          priceLabel: naira(l.priceRules[0]?.amountKobo ?? null),
          createdAt: l.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
