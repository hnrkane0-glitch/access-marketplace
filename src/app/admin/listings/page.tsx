import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import ListingReviewQueue from "./review-queue";

function naira(kobo: number | null): string {
  if (kobo == null) return "—";
  return `₦${(kobo / 100).toLocaleString()}`;
}

export default async function AdminListingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.isAdmin) redirect("/dashboard");

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
    <div className="mx-auto max-w-4xl px-5 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Listing review queue</h1>
      <p className="mt-1 text-sm text-[var(--ink-soft)]">
        Providers submit listings as &quot;pending review&quot;. Nothing appears in
        search until it&apos;s approved here.
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
