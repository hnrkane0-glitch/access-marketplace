import Link from "next/link";
import { db } from "@/lib/db";
import {
  Wallet,
  TrendingUp,
  ShieldCheck,
  Users,
  Banknote,
  AlertTriangle,
  ArrowUpRight,
  Clock,
} from "lucide-react";

function naira(kobo: number): string {
  return `₦${(kobo / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

async function getStats() {
  const [
    gmv,
    commission,
    providerEarnings,
    pendingWithdrawalsAgg,
    pendingPayoutsAgg,
    pendingReviewCount,
    openDisputeCount,
    activeBookingCount,
    totalBookingCount,
    providerCount,
    renterCount,
    recentEntries,
  ] = await Promise.all([
    db.ledgerEntry.aggregate({
      where: { type: "GROSS_BOOKING_REVENUE" },
      _sum: { amountKobo: true },
    }),
    db.ledgerEntry.aggregate({
      where: { type: "PLATFORM_COMMISSION" },
      _sum: { amountKobo: true },
    }),
    db.ledgerEntry.aggregate({
      where: { type: "PROVIDER_EARNING_AVAILABLE", status: "AVAILABLE" },
      _sum: { amountKobo: true },
    }),
    db.withdrawal.aggregate({
      where: { status: "PENDING" },
      _sum: { amountKobo: true },
      _count: true,
    }),
    db.payout.aggregate({
      where: { releasedAt: null },
      _sum: { amountKobo: true },
      _count: true,
    }),
    db.listing.count({ where: { status: "PENDING_REVIEW" } }),
    db.dispute.count({
      where: { status: { in: ["OPEN", "UNDER_REVIEW", "WAITING_FOR_PROVIDER", "WAITING_FOR_CUSTOMER"] } },
    }),
    db.booking.count({
      where: { status: { in: ["CONFIRMED", "CHECKED_IN", "ACTIVE", "CHECKOUT_PENDING"] } },
    }),
    db.booking.count(),
    db.providerProfile.count(),
    db.user.count({ where: { providerProfile: null, isAdmin: false } }),
    db.ledgerEntry.findMany({
      take: 8,
      orderBy: { createdAt: "desc" },
      include: { user: { select: { fullName: true, email: true } } },
    }),
  ]);

  return {
    gmvKobo: gmv._sum.amountKobo ?? 0,
    commissionKobo: commission._sum.amountKobo ?? 0,
    providerEarningsAvailableKobo: providerEarnings._sum.amountKobo ?? 0,
    pendingWithdrawalsKobo: pendingWithdrawalsAgg._sum.amountKobo ?? 0,
    pendingWithdrawalsCount: pendingWithdrawalsAgg._count,
    pendingPayoutsKobo: pendingPayoutsAgg._sum.amountKobo ?? 0,
    pendingPayoutsCount: pendingPayoutsAgg._count,
    pendingReviewCount,
    openDisputeCount,
    activeBookingCount,
    totalBookingCount,
    providerCount,
    renterCount,
    recentEntries,
  };
}

export default async function AdminOverviewPage() {
  const s = await getStats();

  const cards = [
    {
      label: "Gross merchandise value",
      value: naira(s.gmvKobo),
      icon: TrendingUp,
      sub: `${s.totalBookingCount} bookings all-time`,
    },
    {
      label: "Commission earned",
      value: naira(s.commissionKobo),
      icon: Wallet,
      sub: "Platform revenue, all-time",
      accent: true,
    },
    {
      label: "Provider balances (available)",
      value: naira(s.providerEarningsAvailableKobo),
      icon: Banknote,
      sub: "Owed to providers right now",
    },
    {
      label: "Active bookings",
      value: s.activeBookingCount.toLocaleString(),
      icon: Clock,
      sub: "Confirmed through checkout",
    },
    {
      label: "Providers",
      value: s.providerCount.toLocaleString(),
      icon: Users,
      sub: `${s.renterCount.toLocaleString()} renters`,
    },
    {
      label: "Open disputes",
      value: s.openDisputeCount.toLocaleString(),
      icon: AlertTriangle,
      sub: s.openDisputeCount > 0 ? "Needs attention" : "All clear",
      warn: s.openDisputeCount > 0,
    },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
          <p className="mt-1 text-sm text-white/50">Everything on the platform, at a glance.</p>
        </div>
        <div className="flex gap-2">
          {s.pendingReviewCount > 0 && (
            <Link
              href="/admin/listings"
              className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-xl bg-grad-brand pop-shadow hover:opacity-90 transition-opacity"
            >
              <ShieldCheck size={15} />
              {s.pendingReviewCount} listing{s.pendingReviewCount === 1 ? "" : "s"} awaiting review
            </Link>
          )}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((c) => (
          <div
            key={c.label}
            className={`rounded-2xl border p-5 ${
              c.accent
                ? "border-brass/40 bg-gradient-to-br from-[#6d3df0]/20 to-transparent"
                : c.warn
                ? "border-rust/40 bg-rust/5"
                : "border-white/10 bg-white/5"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-white/50 uppercase tracking-wide">{c.label}</span>
              <c.icon size={16} className={c.warn ? "text-rust" : "text-brass"} />
            </div>
            <p className="mt-2 text-2xl font-semibold tracking-tight">{c.value}</p>
            <p className="mt-1 text-xs text-white/40">{c.sub}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 grid lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Wallet size={15} className="text-brass" /> Payouts waiting to release
          </h2>
          <p className="mt-1 text-2xl font-semibold">{naira(s.pendingPayoutsKobo)}</p>
          <p className="text-xs text-white/40 mt-1">{s.pendingPayoutsCount} payout(s) not yet released</p>
          <Link href="/admin/payouts" className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-brass hover:underline">
            Review payouts <ArrowUpRight size={12} />
          </Link>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Banknote size={15} className="text-brass" /> Withdrawal requests
          </h2>
          <p className="mt-1 text-2xl font-semibold">{naira(s.pendingWithdrawalsKobo)}</p>
          <p className="text-xs text-white/40 mt-1">{s.pendingWithdrawalsCount} pending request(s)</p>
          <Link href="/admin/withdrawals" className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-brass hover:underline">
            Review withdrawals <ArrowUpRight size={12} />
          </Link>
        </div>
      </div>

      <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Recent ledger activity</h2>
          <Link href="/admin/transactions" className="text-xs font-medium text-brass hover:underline flex items-center gap-1">
            View all <ArrowUpRight size={12} />
          </Link>
        </div>
        <div className="mt-3 divide-y divide-white/10">
          {s.recentEntries.length === 0 && (
            <p className="py-4 text-sm text-white/40">No transactions yet.</p>
          )}
          {s.recentEntries.map((e) => (
            <div key={e.id} className="flex items-center justify-between py-2.5 text-sm">
              <div className="min-w-0">
                <p className="font-medium truncate">{e.type.replaceAll("_", " ")}</p>
                <p className="text-xs text-white/40 truncate">{e.user.fullName} &middot; {e.user.email}</p>
              </div>
              <span className={`shrink-0 font-medium ${e.direction === "CREDIT" ? "text-emerald-400" : "text-rust"}`}>
                {e.direction === "CREDIT" ? "+" : "-"}
                {naira(e.amountKobo)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
