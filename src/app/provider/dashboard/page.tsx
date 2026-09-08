import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getProviderAvailableBalanceKobo, getProviderPendingBalanceKobo } from "@/lib/ledger";
import { Wallet, Clock3, LayoutGrid, PlusCircle, ArrowRight, Zap, Rocket } from "lucide-react";
import { CATEGORY_ICON, CATEGORY_TINT, DEFAULT_CATEGORY_ICON, DEFAULT_CATEGORY_TINT } from "@/lib/category-visuals";
import WithdrawForm from "./withdraw-form";

const STATUS_STYLE: Record<string, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-700",
  DRAFT: "bg-slate-100 text-slate-600",
  PENDING_REVIEW: "bg-amber-100 text-amber-700",
  PAUSED: "bg-slate-100 text-slate-600",
  REJECTED: "bg-rose-100 text-rose-700",
  ARCHIVED: "bg-slate-100 text-slate-500",
};

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
      include: { category: true, media: { orderBy: { sortOrder: "asc" }, take: 1 } },
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
      <div className="rounded-3xl bg-grad-dark text-white p-8 sm:p-10 pop-shadow relative overflow-hidden flex flex-wrap items-center justify-between gap-5">
        <div aria-hidden className="absolute -right-16 -bottom-16 w-64 h-64 rounded-full bg-orange-500/10" />
        <div>
          <p className="text-sm text-white/60 flex items-center gap-1.5"><Rocket size={14} /> Provider dashboard</p>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight mt-1">Your earnings, at a glance</h1>
        </div>
        <Link
          href="/provider/listings/new"
          className="relative shrink-0 px-5 py-2.5 rounded-full bg-grad-warm text-white text-sm font-medium hover:opacity-90 flex items-center gap-1.5"
        >
          <PlusCircle size={16} /> New listing
        </Link>
      </div>

      <div className="mt-6 grid sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--paper-raised)] p-5 card-shadow">
          <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
            <Wallet size={17} />
          </div>
          <p className="mt-3 text-xs uppercase tracking-wide text-[var(--ink-soft)] font-mono">
            Available to withdraw
          </p>
          <p className="mt-1 text-2xl font-mono font-semibold text-signal">{naira(available)}</p>
        </div>
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--paper-raised)] p-5 card-shadow">
          <div className="w-9 h-9 rounded-lg bg-orange-100 text-orange-700 flex items-center justify-center">
            <Clock3 size={17} />
          </div>
          <p className="mt-3 text-xs uppercase tracking-wide text-[var(--ink-soft)] font-mono">
            Pending (in hold window)
          </p>
          <p className="mt-1 text-2xl font-mono font-semibold">{naira(pending)}</p>
        </div>
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--paper-raised)] p-5 card-shadow">
          <div className="w-9 h-9 rounded-lg bg-violet-100 text-violet-700 flex items-center justify-center">
            <LayoutGrid size={17} />
          </div>
          <p className="mt-3 text-xs uppercase tracking-wide text-[var(--ink-soft)] font-mono">
            Active listings
          </p>
          <p className="mt-1 text-2xl font-mono font-semibold">
            {listings.filter((l) => l.status === "ACTIVE").length}
          </p>
        </div>
      </div>

      {available > 0 && (
        <div className="mt-4 rounded-2xl border border-[var(--line)] bg-[var(--paper-raised)] p-5 card-shadow">
          <p className="text-sm font-medium mb-2">Withdraw earnings</p>
          <WithdrawForm availableKobo={available} />
        </div>
      )}

      {upcomingPayouts.length > 0 && (
        <div className="mt-10">
          <h2 className="font-semibold flex items-center gap-1.5"><Clock3 size={16} /> Payout schedule</h2>
          <div className="mt-4 divide-y divide-[var(--line)] rounded-2xl border border-[var(--line)] bg-[var(--paper-raised)] card-shadow overflow-hidden">
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
        <h2 className="font-semibold flex items-center gap-1.5"><LayoutGrid size={16} /> Your listings</h2>
        {listings.length === 0 ? (
          <div className="mt-3 rounded-2xl border border-dashed border-[var(--line)] bg-[var(--paper-raised)] p-8 text-center">
            <Zap size={24} className="mx-auto text-brass" />
            <p className="text-sm text-[var(--ink-soft)] mt-2">
              No listings yet.{" "}
              <Link href="/provider/listings/new" className="text-brass font-medium hover:underline">
                Create your first one
              </Link>
              .
            </p>
          </div>
        ) : (
          <div className="mt-4 divide-y divide-[var(--line)] rounded-2xl border border-[var(--line)] bg-[var(--paper-raised)] card-shadow overflow-hidden">
            {listings.map((l) => {
              const thumb = l.media[0]?.url;
              const Icon = CATEGORY_ICON[l.category.slug] ?? DEFAULT_CATEGORY_ICON;
              const tint = CATEGORY_TINT[l.category.slug] ?? DEFAULT_CATEGORY_TINT;
              return (
                <div key={l.id} className="flex items-center gap-4 px-5 py-4">
                  <div className="w-14 h-14 rounded-lg overflow-hidden shrink-0 relative">
                    {thumb ? (
                      // eslint-disable-next-line @next/next/no-img-element -- provider-supplied media on arbitrary hosts
                      <img src={thumb} alt="" className="absolute inset-0 w-full h-full object-cover" />
                    ) : (
                      <div className={`w-full h-full bg-gradient-to-br ${tint} flex items-center justify-center`}>
                        <Icon size={20} className="text-white/90" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{l.title}</p>
                    <span className={`inline-block mt-1 text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLE[l.status] ?? "bg-slate-100 text-slate-600"}`}>
                      {l.status.replace("_", " ")}
                    </span>
                  </div>
                  <Link href={`/listings/${l.id}`} className="shrink-0 text-sm text-brass font-medium hover:underline flex items-center gap-1">
                    View <ArrowRight size={13} />
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

