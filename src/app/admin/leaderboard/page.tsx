import { db } from "@/lib/db";
import { Trophy, Crown } from "lucide-react";

function naira(kobo: number): string {
  return `₦${(kobo / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export default async function AdminLeaderboardPage() {
  const [topProviderRevenue, topRenterSpend] = await Promise.all([
    db.ledgerEntry.groupBy({
      by: ["userId"],
      where: { type: "GROSS_BOOKING_REVENUE" },
      _sum: { amountKobo: true },
      orderBy: { _sum: { amountKobo: "desc" } },
      take: 10,
    }),
    db.ledgerEntry.groupBy({
      by: ["userId"],
      where: { type: "BOOKING_PAYMENT" },
      _sum: { amountKobo: true },
      orderBy: { _sum: { amountKobo: "desc" } },
      take: 10,
    }),
  ]);

  const providerUsers = await db.user.findMany({
    where: { id: { in: topProviderRevenue.map((p) => p.userId) } },
    select: { id: true, fullName: true, email: true, providerProfile: { select: { displayName: true } } },
  });
  const renterUsers = await db.user.findMany({
    where: { id: { in: topRenterSpend.map((p) => p.userId) } },
    select: { id: true, fullName: true, email: true },
  });

  const providerMap = new Map(providerUsers.map((u) => [u.id, u]));
  const renterMap = new Map(renterUsers.map((u) => [u.id, u]));

  const providers = topProviderRevenue
    .map((p) => ({ ...p, user: providerMap.get(p.userId) }))
    .filter((p) => p.user);
  const renters = topRenterSpend
    .map((p) => ({ ...p, user: renterMap.get(p.userId) }))
    .filter((p) => p.user);

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Top providers & renters</h1>
      <p className="mt-1 text-sm text-white/50">Ranked by lifetime GMV — who&apos;s actually moving money.</p>

      <div className="mt-6 grid lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <h2 className="text-sm font-semibold flex items-center gap-2 mb-4">
            <Trophy size={15} className="text-amber-400" /> Top providers by revenue
          </h2>
          <ol className="space-y-1">
            {providers.map((p, i) => (
              <li key={p.userId} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      i === 0 ? "bg-amber-400 text-black" : i === 1 ? "bg-white/30 text-black" : i === 2 ? "bg-orange-700/60" : "bg-white/10 text-white/50"
                    }`}
                  >
                    {i === 0 ? <Crown size={12} /> : i + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {p.user?.providerProfile?.displayName || p.user?.fullName}
                    </p>
                    <p className="text-xs text-white/40 truncate">{p.user?.email}</p>
                  </div>
                </div>
                <span className="text-sm font-semibold shrink-0">{naira(p._sum.amountKobo ?? 0)}</span>
              </li>
            ))}
            {providers.length === 0 && <p className="text-sm text-white/40 py-4">No provider revenue yet.</p>}
          </ol>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <h2 className="text-sm font-semibold flex items-center gap-2 mb-4">
            <Trophy size={15} className="text-brass" /> Top renters by spend
          </h2>
          <ol className="space-y-1">
            {renters.map((p, i) => (
              <li key={p.userId} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      i === 0 ? "bg-amber-400 text-black" : i === 1 ? "bg-white/30 text-black" : i === 2 ? "bg-orange-700/60" : "bg-white/10 text-white/50"
                    }`}
                  >
                    {i === 0 ? <Crown size={12} /> : i + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{p.user?.fullName}</p>
                    <p className="text-xs text-white/40 truncate">{p.user?.email}</p>
                  </div>
                </div>
                <span className="text-sm font-semibold shrink-0">{naira(p._sum.amountKobo ?? 0)}</span>
              </li>
            ))}
            {renters.length === 0 && <p className="text-sm text-white/40 py-4">No renter spend yet.</p>}
          </ol>
        </div>
      </div>
    </div>
  );
}
