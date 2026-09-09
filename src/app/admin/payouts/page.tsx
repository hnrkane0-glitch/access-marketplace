import { db } from "@/lib/db";
import PayoutTable from "./payout-table";

export default async function AdminPayoutsPage() {
  const payouts = await db.payout.findMany({
    where: { releasedAt: null },
    orderBy: { availableAt: "asc" },
    include: {
      booking: {
        select: {
          id: true,
          listing: { select: { title: true } },
        },
      },
    },
    take: 100,
  });

  const providerIds = [...new Set(payouts.map((p) => p.providerId))];
  const providers = await db.user.findMany({
    where: { id: { in: providerIds } },
    select: { id: true, fullName: true, email: true },
  });
  const providerMap = new Map(providers.map((p) => [p.id, p]));

  const rows = payouts.map((p) => ({
    id: p.id,
    bookingId: p.bookingId,
    listingTitle: p.booking.listing.title,
    providerName: providerMap.get(p.providerId)?.fullName ?? "Unknown",
    providerEmail: providerMap.get(p.providerId)?.email ?? "",
    amountKobo: p.amountKobo,
    availableAt: p.availableAt.toISOString(),
    holdReason: p.holdReason,
  }));

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Payouts</h1>
      <p className="mt-1 text-sm text-white/50">
        Provider earnings waiting out the payout hold window, or held for a dispute. Release early or place a hold.
      </p>
      <PayoutTable rows={rows} />
    </div>
  );
}
