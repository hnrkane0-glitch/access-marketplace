import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getProviderAvailableBalanceKobo, getProviderPendingBalanceKobo } from "@/lib/ledger";

function naira(kobo: number): string {
  return `₦${(kobo / 100).toLocaleString()}`;
}

function daysUntil(date: Date): string {
  const ms = date.getTime() - Date.now();
  if (ms <= 0) return "today";
  const days = Math.ceil(ms / (1000 * 60 * 60 * 24));
  return days === 1 ? "1 day" : `${days} days`;
}

export default async function ProviderDashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.isProvider) redirect("/provider/onboarding");

  const [available, pending, listings, upcomingPayouts] = await Promise.all([
    getProviderAvailableBalanceKobo(user.id),
    getProviderPendingBalanceKobo(user.id),
    db.listing.findMany({
      where: { providerId: user.id },
      orderBy: { createdAt: "desc" },
    }),
    db.payout.findMany({
      where: { providerId: user.id, releasedAt: null },
      orderBy: { availableAt: "asc" },
      take: 5,
      include: { booking: { include: { listing: { select: { title: true } } } } },
    }),
  ]);

  return (
    <div className="mx-auto max-w-5xl px-5 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Provider dashboard</h1>
        <Link
          href="/provider/listings/new"
          className="px-4 py-2 rounded-lg bg-ink text-paper text-sm font-medium hover:bg-[var(--ink-soft)]"
        >
          + New listing
        </Link>
      </div>

      <div className="mt-6 grid sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-[var(--line)] p-5">
          <p className="text-xs uppercase tracking-wide text-[var(--ink-soft)] font-mono">
            Available to withdraw
          </p>
          <p className="mt-2 text-2xl font-mono font-semibold text-signal">{naira(available)}</p>
        </div>
        <div className="rounded-xl border border-[var(--line)] p-5">
          <p className="text-xs uppercase tracking-wide text-[var(--ink-soft)] font-mono">
            Pending (in hold window)
          </p>
          <p className="mt-2 text-2xl font-mono font-semibold">{naira(pending)}</p>
        </div>
        <div className="rounded-xl border border-[var(--line)] p-5 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-[var(--ink-soft)] font-mono">
              Active listings
            </p>
            <p className="mt-2 text-2xl font-mono font-semibold">
              {listings.filter((l) => l.status === "ACTIVE").length}
            </p>
          </div>
        </div>
      </div>

      {available >= 500_000 && (
        <div className="mt-4">
          <form action="/api/payouts/withdraw" method="post" className="inline">
            <WithdrawButton available={available} />
          </form>
        </div>
      )}

      {upcomingPayouts.length > 0 && (
        <div className="mt-10">
          <h2 className="font-semibold">Payout schedule</h2>
          <div className="mt-4 divide-y divide-[var(--line)] rounded-xl border border-[var(--line)]">
            {upcomingPayouts.map((p) => (
              <div key={p.id} className="flex items-center justify-between px-5 py-4">
                <div>
                  <p className="font-medium">{p.booking.listing.title}</p>
                  <p className="text-sm text-[var(--ink-soft)]">
                    {p.holdReason
                      ? `On hold — ${p.holdReason.toLowerCase()}`
                      : `Available in ${daysUntil(p.availableAt)}`}
                  </p>
                </div>
                <span className="font-mono">{naira(p.amountKobo)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-10">
        <h2 className="font-semibold">Your listings</h2>
        {listings.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--ink-soft)]">
            No listings yet.{" "}
            <Link href="/provider/listings/new" className="text-brass-dim hover:underline">
              Create your first one
            </Link>
            .
          </p>
        ) : (
          <div className="mt-4 divide-y divide-[var(--line)] rounded-xl border border-[var(--line)]">
            {listings.map((l) => (
              <div key={l.id} className="flex items-center justify-between px-5 py-4">
                <div>
                  <p className="font-medium">{l.title}</p>
                  <p className="text-sm text-[var(--ink-soft)]">{l.status}</p>
                </div>
                <Link href={`/listings/${l.id}`} className="text-sm text-brass-dim hover:underline">
                  View
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function WithdrawButton({ available }: { available: number }) {
  // Kept server-safe and simple: a real implementation wires this to a
  // client component that calls /api/payouts/withdraw with a chosen
  // amount. Left as a clearly-labeled next step rather than faked.
  return (
    <p className="text-sm text-[var(--ink-soft)]">
      You have {naira(available)} available.{" "}
      <span className="text-brass-dim">Withdraw flow: wire this button to /api/payouts/withdraw.</span>
    </p>
  );
}
