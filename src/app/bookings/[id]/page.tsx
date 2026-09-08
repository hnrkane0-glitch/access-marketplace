import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import BookingActions from "@/components/booking-actions";
import MessageThread from "@/components/message-thread";
import ReviewForm from "@/components/review-form";

function naira(kobo: number): string {
  return `₦${(kobo / 100).toLocaleString()}`;
}

export default async function BookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const booking = await db.booking.findUnique({
    where: { id },
    include: {
      listing: { include: { location: true, provider: { select: { fullName: true } } } },
      customer: { select: { fullName: true } },
      deposit: true,
      payout: true,
    },
  });

  if (!booking) notFound();
  const isCustomer = booking.customerId === user.id;
  const isProvider = booking.listing.providerId === user.id;
  if (!isCustomer && !isProvider && !user.isAdmin) notFound();

  const ELIGIBLE_REVIEW_STATUSES = ["COMPLETED", "PAYOUT_PENDING", "PAYOUT_RELEASED"];
  const myExistingReview =
    (isCustomer || isProvider) && ELIGIBLE_REVIEW_STATUSES.includes(booking.status)
      ? await db.review.findUnique({
          where: { bookingId_authorId: { bookingId: booking.id, authorId: user.id } },
        })
      : null;
  const canReview =
    (isCustomer || isProvider) &&
    ELIGIBLE_REVIEW_STATUSES.includes(booking.status) &&
    !myExistingReview;

  return (
    <div className="mx-auto max-w-2xl px-5 py-10">
      <div className="rounded-2xl border border-[var(--line)] overflow-hidden">
        <div className="bg-ink text-paper p-6">
          <p className="text-xs uppercase tracking-[0.15em] text-brass font-mono">
            Booking #{booking.id.slice(-8).toUpperCase()}
          </p>
          <p className="mt-2 text-xl font-semibold">{booking.listing.title}</p>
          <p className="text-sm text-paper/70">
            {booking.listing.location.city} · {booking.startsAt.toLocaleString()} –{" "}
            {booking.endsAt.toLocaleTimeString()}
          </p>
        </div>

        <div className="p-6">
          <dl className="grid grid-cols-2 gap-y-3 text-sm">
            <dt className="text-[var(--ink-soft)]">Status</dt>
            <dd className="text-right font-mono">{booking.status}</dd>

            <dt className="text-[var(--ink-soft)]">Customer</dt>
            <dd className="text-right">{booking.customer.fullName}</dd>

            <dt className="text-[var(--ink-soft)]">Provider</dt>
            <dd className="text-right">{booking.listing.provider.fullName}</dd>

            <dt className="text-[var(--ink-soft)]">Booking amount</dt>
            <dd className="text-right font-mono">{naira(booking.bookingAmountKobo)}</dd>

            {booking.depositAmountKobo > 0 && (
              <>
                <dt className="text-[var(--ink-soft)]">Deposit</dt>
                <dd className="text-right font-mono">
                  {naira(booking.depositAmountKobo)}{" "}
                  <span className="text-xs text-[var(--ink-soft)]">
                    ({booking.deposit?.status ?? "—"})
                  </span>
                </dd>
              </>
            )}

            <dt className="text-[var(--ink-soft)] font-medium">Total paid</dt>
            <dd className="text-right font-mono font-medium">{naira(booking.totalAmountKobo)}</dd>
          </dl>

          {booking.accessCode && isCustomer && (
            <div className="mt-6 pt-6 border-t border-dashed border-[var(--line)] flex items-center justify-between">
              <div>
                <p className="text-xs text-[var(--ink-soft)]">Show this code at check-in</p>
                <p className="text-2xl font-mono tracking-widest text-brass-dim">
                  {booking.accessCode}
                </p>
              </div>
            </div>
          )}

          {booking.payout && (
            <div className="mt-6 pt-6 border-t border-[var(--line)]">
              <p className="text-sm font-medium">Payout</p>
              <p className="text-sm text-[var(--ink-soft)] mt-1">
                {booking.payout.releasedAt
                  ? `Released ${booking.payout.releasedAt.toLocaleDateString()}`
                  : booking.payout.holdReason
                  ? `On hold — ${booking.payout.holdReason.toLowerCase()}`
                  : `Scheduled for ${booking.payout.availableAt.toLocaleDateString()}`}
              </p>
            </div>
          )}

          <BookingActions
            bookingId={booking.id}
            status={booking.status}
            isCustomer={isCustomer}
            isProvider={isProvider}
          />

          {(isCustomer || isProvider) && <MessageThread bookingId={booking.id} />}

          {canReview && (
            <ReviewForm
              bookingId={booking.id}
              subjectLabel={isCustomer ? booking.listing.provider.fullName : booking.customer.fullName}
            />
          )}
        </div>
      </div>
    </div>
  );
}
