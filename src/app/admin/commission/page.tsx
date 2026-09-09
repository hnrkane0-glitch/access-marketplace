import { db } from "@/lib/db";
import { getSetting } from "@/lib/platform-settings";
import CommissionEditor from "./commission-editor";

function naira(kobo: number): string {
  return `₦${(kobo / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export default async function AdminCommissionPage() {
  const [platformCommissionBps, totalCommission, thisMonthCommission, providersWithOverride] = await Promise.all([
    getSetting<number>("platformCommissionBps"),
    db.ledgerEntry.aggregate({
      where: { type: "PLATFORM_COMMISSION" },
      _sum: { amountKobo: true },
    }),
    db.ledgerEntry.aggregate({
      where: {
        type: "PLATFORM_COMMISSION",
        createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
      },
      _sum: { amountKobo: true },
    }),
    db.providerProfile.count({ where: { commissionOverride: { not: null } } }),
  ]);

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold tracking-tight">Commission</h1>
      <p className="mt-1 text-sm text-white/50">
        The cut the platform takes on every booking. Individual providers can still have a custom override (set on their profile) that takes priority over this default.
      </p>

      <div className="mt-6 grid sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <p className="text-xs text-white/40 uppercase tracking-wide">All-time commission</p>
          <p className="mt-1 text-xl font-semibold">{naira(totalCommission._sum.amountKobo ?? 0)}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <p className="text-xs text-white/40 uppercase tracking-wide">This month</p>
          <p className="mt-1 text-xl font-semibold">{naira(thisMonthCommission._sum.amountKobo ?? 0)}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <p className="text-xs text-white/40 uppercase tracking-wide">Custom overrides</p>
          <p className="mt-1 text-xl font-semibold">{providersWithOverride}</p>
        </div>
      </div>

      <CommissionEditor currentBps={platformCommissionBps} />
    </div>
  );
}
