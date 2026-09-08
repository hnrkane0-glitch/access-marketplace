import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getCustomerReservedDepositsKobo } from "@/lib/ledger";
import { LedgerEntryType, LedgerEntryStatus } from "@prisma/client";

function naira(kobo: number): string {
  return `₦${(kobo / 100).toLocaleString()}`;
}

const STATUS_LABEL: Record<string, string> = {
  REQUESTED: "Requested",
  PAYMENT_PENDING: "Awaiting payment",
  PAID: "Paid",
  CONFIRMED: "Confirmed",
  CHECKED_IN: "Checked in",
  ACTIVE: "Active",
  CHECKOUT_PENDING: "Checking out",
  COMPLETED: "Completed",
  PAYOUT_PENDING: "Completed",
  PAYOUT_RELEASED: "Completed",
  CANCELLED: "Cancelled",
  REFUND_PENDING: "Refund pending",
  REFUNDED: "Refunded",
  DISPUTED: "Disputed",
  UNDER_REVIEW: "Under review",
  SUSPENDED: "Suspended",
  PAYMENT_FAILED: "Payment failed",
};

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [bookings, totalSpentAgg, reservedDeposits] = await Promise.all([
    db.booking.findMany({
      where: { customerId: user.id },
      include: { listing: { select: { title: true, location: true } } },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    db.ledgerEntry.aggregate({
      where: {
        userId: user.id,
        type: LedgerEntryType.BOOKING_PAYMENT,
        status: { in: [LedgerEntryStatus.RESERVED, LedgerEntryStatus.RELEASED] },
      },
      _sum: { amountKobo: true },
    }),
    getCustomerReservedDepositsKobo(user.id),
  ]);

  const upcoming = bookings.filter((b) =>
    ["CONFIRMED", "CHECKED_IN", "ACTIVE", "PAYMENT_PENDING", "REQUESTED"].includes(b.status)
  );

  return (
    <div className="mx-auto max-w-5xl px-5 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Welcome back, {user.fullName.split(" ")[0]}</h1>

      <div className="mt-6 grid sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-[var(--line)] p-5">
          <p className="text-xs uppercase tracking-wide text-[var(--ink-soft)] font-mono">
            Total spent
          </p>
          <p className="mt-2 text-2xl font-mono font-semibold">
            {naira(totalSpentAgg._sum.amountKobo ?? 0)}
          </p>
        </div>
        <div className="rounded-xl border border-[var(--line)] p-5">
          <p className="text-xs uppercase tracking-wide text-[var(--ink-soft)] font-mono">
            Deposits held
          </p>
          <p className="mt-2 text-2xl font-mono font-semibold">{naira(reservedDeposits)}</p>
          <p className="text-xs text-[var(--ink-soft)] mt-1">Refundable after checkout</p>
        </div>
        <div className="rounded-xl border border-[var(--line)] p-5">
          <p className="text-xs uppercase tracking-wide text-[var(--ink-soft)] font-mono">
            Upcoming bookings
          </p>
          <p className="mt-2 text-2xl font-mono font-semibold">{upcoming.length}</p>
        </div>
      </div>

      {!user.isProvider && (
        <div className="mt-6 rounded-xl border border-dashed border-brass/50 bg-brass/5 p-5 flex items-center justify-between">
          <div>
            <p className="font-medium">Have unused space, equipment, or time?</p>
            <p className="text-sm text-[var(--ink-soft)]">List it and start earning from unused capacity.</p>
          </div>
          <Link
            href="/provider/onboarding"
            className="shrink-0 px-4 py-2 rounded-lg bg-ink text-paper text-sm font-medium hover:bg-[var(--ink-soft)]"
          >
            Become a provider
          </Link>
        </div>
      )}

      <div className="mt-10">
        <h2 className="font-semibold">Your bookings</h2>
        {bookings.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--ink-soft)]">
            No bookings yet.{" "}
            <Link href="/search" className="text-brass-dim hover:underline">
              Start browsing
            </Link>
            .
          </p>
        ) : (
          <div className="mt-4 divide-y divide-[var(--line)] rounded-xl border border-[var(--line)]">
            {bookings.map((b) => (
              <Link
                key={b.id}
                href={`/bookings/${b.id}`}
                className="flex items-center justify-between px-5 py-4 hover:bg-[var(--paper-raised)]"
              >
                <div>
                  <p className="font-medium">{b.listing.title}</p>
                  <p className="text-sm text-[var(--ink-soft)]">
                    {b.startsAt.toLocaleDateString()} · {naira(b.totalAmountKobo)}
                  </p>
                </div>
                <span className="text-sm font-mono px-2.5 py-1 rounded-full border border-[var(--line)]">
                  {STATUS_LABEL[b.status] ?? b.status}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
