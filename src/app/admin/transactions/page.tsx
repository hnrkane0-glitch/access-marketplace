import { db } from "@/lib/db";

function naira(kobo: number): string {
  return `₦${(kobo / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export default async function AdminTransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const { type } = await searchParams;

  const entries = await db.ledgerEntry.findMany({
    where: type ? { type: type as never } : undefined,
    take: 100,
    orderBy: { createdAt: "desc" },
    include: { user: { select: { fullName: true, email: true } }, booking: { select: { id: true } } },
  });

  const types = [
    "BOOKING_PAYMENT",
    "DEPOSIT_HELD",
    "DEPOSIT_REFUNDED",
    "REFUND",
    "GROSS_BOOKING_REVENUE",
    "PLATFORM_COMMISSION",
    "PROVIDER_EARNING_PENDING",
    "PROVIDER_EARNING_AVAILABLE",
    "WITHDRAWAL_REQUESTED",
    "WITHDRAWAL_COMPLETED",
    "DISPUTE_HOLD",
    "REFUND_DEDUCTION",
    "ADMIN_CREDIT",
    "ADMIN_DEBIT",
  ];

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Transactions</h1>
      <p className="mt-1 text-sm text-white/50">Every ledger entry ever posted — this is the immutable source of truth for money movement.</p>

      <div className="mt-4 flex flex-wrap gap-1.5">
        <a
          href="/admin/transactions"
          className={`text-xs px-3 py-1.5 rounded-full border ${!type ? "bg-grad-brand border-transparent" : "border-white/15 text-white/50 hover:text-white"}`}
        >
          All
        </a>
        {types.map((t) => (
          <a
            key={t}
            href={`/admin/transactions?type=${t}`}
            className={`text-xs px-3 py-1.5 rounded-full border ${type === t ? "bg-grad-brand border-transparent" : "border-white/15 text-white/50 hover:text-white"}`}
          >
            {t.replaceAll("_", " ")}
          </a>
        ))}
      </div>

      <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 overflow-x-auto">
        <table className="w-full text-sm min-w-[820px]">
          <thead>
            <tr className="text-left text-xs text-white/40 uppercase tracking-wide border-b border-white/10">
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">User</th>
              <th className="px-4 py-3 font-medium">Booking</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id} className="border-b border-white/5 last:border-0">
                <td className="px-4 py-3 text-white/50 text-xs">{e.createdAt.toLocaleString()}</td>
                <td className="px-4 py-3">{e.type.replaceAll("_", " ")}</td>
                <td className="px-4 py-3">
                  <p className="font-medium">{e.user.fullName}</p>
                  <p className="text-xs text-white/40">{e.user.email}</p>
                </td>
                <td className="px-4 py-3 text-xs text-white/40">{e.booking?.id.slice(0, 8) ?? "—"}</td>
                <td className="px-4 py-3">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-white/60">{e.status}</span>
                </td>
                <td className={`px-4 py-3 text-right font-medium ${e.direction === "CREDIT" ? "text-emerald-400" : "text-rust"}`}>
                  {e.direction === "CREDIT" ? "+" : "-"}
                  {naira(e.amountKobo)}
                </td>
              </tr>
            ))}
            {entries.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-white/40">
                  No transactions{type ? " of this type" : ""} yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
