import { db } from "@/lib/db";
import ProviderTable from "./provider-table";

export default async function AdminProvidersPage() {
  const providers = await db.providerProfile.findMany({
    include: {
      user: { select: { id: true, fullName: true, email: true, isSuspended: true, createdAt: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const providerIds = providers.map((p) => p.userId);

  const [listingCounts, revenueByProvider, availableByProvider] = await Promise.all([
    db.listing.groupBy({
      by: ["providerId"],
      where: { providerId: { in: providerIds } },
      _count: { _all: true },
    }),
    db.ledgerEntry.groupBy({
      by: ["userId"],
      where: { userId: { in: providerIds }, type: "GROSS_BOOKING_REVENUE" },
      _sum: { amountKobo: true },
    }),
    db.ledgerEntry.groupBy({
      by: ["userId"],
      where: { userId: { in: providerIds }, type: "PROVIDER_EARNING_AVAILABLE", status: "AVAILABLE" },
      _sum: { amountKobo: true },
    }),
  ]);

  const listingCountMap = new Map(listingCounts.map((l) => [l.providerId, l._count._all]));
  const revenueMap = new Map(revenueByProvider.map((r) => [r.userId, r._sum.amountKobo ?? 0]));
  const availableMap = new Map(availableByProvider.map((r) => [r.userId, r._sum.amountKobo ?? 0]));

  const rows = providers.map((p) => ({
    id: p.userId,
    name: p.user.fullName,
    email: p.user.email,
    displayName: p.displayName,
    verificationLevel: p.verificationLevel,
    isSuspended: p.user.isSuspended,
    listingCount: listingCountMap.get(p.userId) ?? 0,
    revenueKobo: revenueMap.get(p.userId) ?? 0,
    availableKobo: availableMap.get(p.userId) ?? 0,
    commissionOverrideBps: p.commissionOverride,
    joined: p.user.createdAt.toISOString(),
  }));

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Providers</h1>
      <p className="mt-1 text-sm text-white/50">
        {providers.length} provider account{providers.length === 1 ? "" : "s"} on the platform.
      </p>
      <ProviderTable rows={rows} />
    </div>
  );
}
