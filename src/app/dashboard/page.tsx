import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getCustomerReservedDepositsKobo, getWalletBalanceKobo } from "@/lib/ledger";
import { LedgerEntryType, LedgerEntryStatus } from "@prisma/client";
import { Wallet, ShieldCheck, CalendarClock, Compass, Sparkles, ArrowRight, CalendarDays } from "lucide-react";
import WalletCard from "@/components/wallet-card";
import SubscriptionBanner from "@/components/subscription-banner";
import { getSubscriptionSafe } from "@/lib/subscription";

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

  const [bookings, totalSpentAgg, reservedDeposits, walletBalance, subscription] = await Promise.all([
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
    getWalletBalanceKobo(user.id),
    getSubscriptionSafe(user.id),
  ]);

  const upcoming = bookings.filter((b) =>
    ["CONFIRMED", "CHECKED_IN", "ACTIVE", "PAYMENT_PENDING", "REQUESTED"].includes(b.status)
  );

  return (
    <div className="mx-auto max-w-5xl px-5 py-10">
      <div className="rounded-3xl bg-grad-brand text-white p-8 sm:p-10 pop-shadow relative overflow-hidden">
        <div aria-hidden className="absolute -right-10 -top-10 w-56 h-56 rounded-full bg-white/10" />
        <p className="text-sm text-white/70 flex items-center gap-1.5"><Sparkles size={14} /> Renter dashboard</p>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight mt-1">
          Welcome back, {user.fullName.split(" ")[0]}
        </h1>
        <Link
          href="/search"
          className="mt-5 inline-flex items-center gap-2 rounded-full bg-white text-[var(--ink)] font-medium px-5 py-2.5 hover:opacity-90 transition-opacity"
        >
          <Compass size={16} /> Browse listings <ArrowRight size={14} />
        </Link>
      </div>

      <div className="mt-6 grid sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--paper-raised)] p-5 card-shadow">
          <div className="w-9 h-9 rounded-lg bg-violet-100 text-violet-700 flex items-center justify-center">
            <Wallet size={17} />
          </div>
          <p className="mt-3 text-xs uppercase tracking-wide text-[var(--ink-soft)] font-mono">
            Total spent
          </p>
          <p className="mt-1 text-2xl font-mono font-semibold">
            {naira(totalSpentAgg._sum.amountKobo ?? 0)}
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--paper-raised)] p-5 card-shadow">
          <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
            <ShieldCheck size={17} />
          </div>
          <p className="mt-3 text-xs uppercase tracking-wide text-[var(--ink-soft)] font-mono">
            Deposits held
          </p>
          <p className="mt-1 text-2xl font-mono font-semibold">{naira(reservedDeposits)}</p>
          <p className="text-xs text-[var(--ink-soft)] mt-1">Refundable after checkout</p>
        </div>
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--paper-raised)] p-5 card-shadow">
          <div className="w-9 h-9 rounded-lg bg-orange-100 text-orange-700 flex items-center justify-center">
            <CalendarClock size={17} />
          </div>
          <p className="mt-3 text-xs uppercase tracking-wide text-[var(--ink-soft)] font-mono">
            Upcoming bookings
          </p>
          <p className="mt-1 text-2xl font-mono font-semibold">{upcoming.length}</p>
        </div>
      </div>

      <SubscriptionBanner
        subscription={
          subscription
            ? {
                tier: subscription.tier,
                status: subscription.status,
                trialEndsAt: subscription.trialEndsAt?.toISOString() ?? null,
              }
            : null
        }
      />

      <div className="mt-4">
        <WalletCard balanceKobo={walletBalance} />
      </div>

      {!user.isProvider && (
        <div className="mt-6 rounded-2xl border border-dashed border-brass/40 bg-gradient-to-r from-violet-50 to-orange-50 p-5 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-grad-warm text-white flex items-center justify-center shrink-0">
              <Sparkles size={18} />
            </div>
            <div>
              <p className="font-medium">Have unused space, equipment, or time?</p>
              <p className="text-sm text-[var(--ink-soft)]">List it and start earning from unused capacity.</p>
            </div>
          </div>
          <Link
            href="/provider/onboarding"
            className="shrink-0 px-4 py-2 rounded-lg bg-ink text-paper text-sm font-medium hover:bg-[var(--ink-soft)] flex items-center gap-1.5"
          >
            Become a provider <ArrowRight size={14} />
          </Link>
        </div>
      )}

      <div className="mt-10">
        <h2 className="font-semibold flex items-center gap-1.5"><CalendarDays size={16} /> Your bookings</h2>
        {bookings.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--ink-soft)]">
            No bookings yet.{" "}
            <Link href="/search" className="text-brass font-medium hover:underline">
              Start browsing
            </Link>
            .
          </p>
        ) : (
          <div className="mt-4 divide-y divide-[var(--line)] rounded-2xl border border-[var(--line)] bg-[var(--paper-raised)] card-shadow overflow-hidden">
            {bookings.map((b) => (
              <Link
                key={b.id}
                href={`/bookings/${b.id}`}
                className="flex items-center justify-between px-5 py-4 hover:bg-violet-50/60 transition-colors"
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
