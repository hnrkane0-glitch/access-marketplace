import { db } from "@/lib/db";
import RenterTable from "./renter-table";

export default async function AdminRentersPage() {
  const renters = await db.user.findMany({
    where: { providerProfile: null, isAdmin: false },
    select: { id: true, fullName: true, email: true, isSuspended: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  const renterIds = renters.map((r) => r.id);

  const [spendByRenter, bookingCounts] = await Promise.all([
    db.ledgerEntry.groupBy({
      by: ["userId"],
      where: { userId: { in: renterIds }, type: "BOOKING_PAYMENT" },
      _sum: { amountKobo: true },
    }),
    db.booking.groupBy({
      by: ["customerId"],
      where: { customerId: { in: renterIds } },
      _count: { _all: true },
    }),
  ]);

  const spendMap = new Map(spendByRenter.map((s) => [s.userId, s._sum.amountKobo ?? 0]));
  const bookingMap = new Map(bookingCounts.map((b) => [b.customerId, b._count._all]));

  const rows = renters.map((r) => ({
    id: r.id,
    name: r.fullName,
    email: r.email,
    isSuspended: r.isSuspended,
    totalSpentKobo: spendMap.get(r.id) ?? 0,
    bookingCount: bookingMap.get(r.id) ?? 0,
    joined: r.createdAt.toISOString(),
  }));

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Renters</h1>
      <p className="mt-1 text-sm text-white/50">
        {renters.length} renter account{renters.length === 1 ? "" : "s"} on the platform.
      </p>
      <RenterTable rows={rows} />
    </div>
  );
}
