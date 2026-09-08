import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import BookingWidget from "@/components/booking-widget";
import { BadgeCheck, ShieldCheck, Wallet, Zap, PlayCircle } from "lucide-react";
import { CATEGORY_ICON, CATEGORY_TINT, DEFAULT_CATEGORY_ICON, DEFAULT_CATEGORY_TINT } from "@/lib/category-visuals";

const UNIT_LABEL: Record<string, string> = {
  HOURLY: "hour",
  DAILY: "day",
  WEEKLY: "week",
  MONTHLY: "month",
  PER_PERSON: "person",
  PER_UNIT: "unit",
  PER_SESSION: "session",
};

export default async function ListingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [listing, user] = await Promise.all([
    db.listing.findUnique({
      where: { id },
      include: {
        category: true,
        location: true,
        media: { orderBy: { sortOrder: "asc" } },
        priceRules: { where: { appliesTo: "BASE" }, take: 1 },
        depositRule: true,
        provider: { select: { fullName: true, verificationLevel: true, createdAt: true } },
        reviews: { take: 5, orderBy: { createdAt: "desc" } },
      },
    }),
    getCurrentUser().catch(() => null),
  ]);

  if (!listing || listing.status !== "ACTIVE") notFound();

  const basePrice = listing.priceRules[0];
  const Icon = CATEGORY_ICON[listing.category.slug] ?? DEFAULT_CATEGORY_ICON;
  const tint = CATEGORY_TINT[listing.category.slug] ?? DEFAULT_CATEGORY_TINT;
  const [hero, ...rest] = listing.media;

  return (
    <div className="mx-auto max-w-6xl px-5 py-10 grid lg:grid-cols-[1.6fr_1fr] gap-10">
      <div>
        {hero ? (
          <div className="grid grid-cols-4 grid-rows-2 gap-2 rounded-2xl overflow-hidden aspect-[16/9]">
            <div className="col-span-4 sm:col-span-2 row-span-2 relative bg-[var(--line)]">
              {hero.type === "VIDEO" ? (
                <>
                  <video src={hero.url} className="absolute inset-0 w-full h-full object-cover" muted loop playsInline />
                  <PlayCircle size={40} className="absolute inset-0 m-auto text-white drop-shadow" />
                </>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element -- provider-supplied media on arbitrary hosts
                <img src={hero.url} alt={listing.title} className="absolute inset-0 w-full h-full object-cover" />
              )}
            </div>
            {rest.slice(0, 4).map((m) => (
              <div key={m.id} className="hidden sm:block relative bg-[var(--line)]">
                {m.type === "VIDEO" ? (
                  <>
                    <video src={m.url} className="absolute inset-0 w-full h-full object-cover" muted loop playsInline />
                    <PlayCircle size={20} className="absolute inset-0 m-auto text-white drop-shadow" />
                  </>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element -- provider-supplied media on arbitrary hosts
                  <img src={m.url} alt="" className="absolute inset-0 w-full h-full object-cover" />
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className={`aspect-[16/9] rounded-2xl overflow-hidden bg-gradient-to-br ${tint} flex items-center justify-center`}>
            <Icon size={56} className="text-white/90" />
          </div>
        )}

        <div className="mt-6">
          <p className="text-sm text-brass font-medium flex items-center gap-1.5">
            <Icon size={14} /> {listing.category.name}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight mt-1">{listing.title}</h1>
          <p className="text-[var(--ink-soft)] mt-1">
            {listing.location.area ? `${listing.location.area}, ` : ""}
            {listing.location.city}, {listing.location.state}
          </p>

          {/* ACCESS READY trust panel — spec §81 */}
          <div className="mt-6 rounded-xl border border-[var(--line)] bg-[var(--paper-raised)] p-5 card-shadow">
            <p className="text-xs uppercase tracking-wide text-[var(--ink-soft)] font-mono mb-3 flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-signal" /> Access Ready
            </p>
            <ul className="grid sm:grid-cols-2 gap-2.5 text-sm">
              <li className="flex items-center gap-2">
                <BadgeCheck size={16} className="text-signal shrink-0" />
                {listing.provider.verificationLevel !== "UNVERIFIED"
                  ? "Verified provider"
                  : "Provider not yet verified"}
              </li>
              <li className="flex items-center gap-2">
                <Wallet size={16} className="text-signal shrink-0" />
                Secure payment via Paystack
              </li>
              <li className="flex items-center gap-2">
                <ShieldCheck size={16} className="text-signal shrink-0" />
                {listing.depositRule && listing.depositRule.mode !== "NONE"
                  ? "Deposit protected"
                  : "No deposit required"}
              </li>
              <li className="flex items-center gap-2">
                <Zap size={16} className="text-signal shrink-0" />
                {listing.instantBook ? "Instant booking" : "Request to book"}
              </li>
            </ul>
          </div>

          <div className="mt-8">
            <h2 className="font-semibold">About this listing</h2>
            <p className="mt-2 text-[var(--ink-soft)] whitespace-pre-line leading-relaxed">
              {listing.description}
            </p>
          </div>

          <div className="mt-8">
            <h2 className="font-semibold">Cancellation policy</h2>
            <p className="mt-2 text-sm text-[var(--ink-soft)]">
              {listing.cancellationPolicy === "FLEXIBLE" &&
                "Full refund if cancelled at least 24 hours before the booking starts."}
              {listing.cancellationPolicy === "MODERATE" &&
                "Partial refund for cancellations — the closer to the booking, the less is refunded."}
              {listing.cancellationPolicy === "STRICT" &&
                "Limited refund available. Review the terms before booking."}
            </p>
          </div>

          {listing.reviews.length > 0 && (
            <div className="mt-8">
              <h2 className="font-semibold">Reviews</h2>
              <div className="mt-3 space-y-4">
                {listing.reviews.map((r) => (
                  <div key={r.id} className="border-t border-[var(--line)] pt-4">
                    <p className="text-sm font-medium">{r.overallRating} / 5</p>
                    {r.comment && <p className="text-sm text-[var(--ink-soft)] mt-1">{r.comment}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div>
        <div className="rounded-xl border border-[var(--line)] p-5 mb-4">
          <p className="text-2xl font-mono font-semibold">
            {basePrice ? `₦${(basePrice.amountKobo / 100).toLocaleString()}` : "Contact for price"}
            {basePrice && (
              <span className="text-sm font-sans text-[var(--ink-soft)] font-normal">
                {" "}
                / {UNIT_LABEL[basePrice.unit]}
              </span>
            )}
          </p>
        </div>
        <BookingWidget
          listingId={listing.id}
          isLoggedIn={!!user}
          minBookingMinutes={listing.minBookingMinutes}
        />
      </div>
    </div>
  );
}
