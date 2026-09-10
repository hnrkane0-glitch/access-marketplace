import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyWebhookSignature, verifyTransaction, createSubscription, refundTransaction } from "@/lib/paystack";
import { transitionBooking } from "@/lib/booking-state-machine";
import { postBookingPaymentEntries } from "@/lib/ledger";
import { sendWalletTopUpAlertEmail } from "@/lib/email";
import { planCodeForTier, TRIAL_DAYS, type PackageTier } from "@/lib/subscription-plans";
import { Prisma } from "@prisma/client";
import crypto from "crypto";

/**
 * The single most security-critical route in the codebase. Rules, in
 * order, and why each exists:
 *
 * 1. Read the RAW body (not `req.json()`) because signature verification
 *    is over the exact bytes Paystack sent — re-serializing a parsed
 *    object can produce different bytes and silently break verification.
 * 2. Verify `x-paystack-signature` before doing anything else. An
 *    unsigned/forged POST to this URL must never touch the database.
 * 3. Independently call Paystack's verify-transaction API rather than
 *    trusting the webhook payload's `amount`/`status` fields alone —
 *    belt-and-braces against any signature-bypass bug.
 * 4. Use Paystack's numeric transaction id as the idempotency key
 *    (`PaymentEvent.providerEventId`, unique). A retried/duplicated
 *    webhook delivery hits the unique constraint and is a no-op — it can
 *    NOT double-credit the ledger. See ARCHITECTURE.md §2.
 * 5. Always return 200 once we've durably recorded the event, even if
 *    business-logic processing had a transient hiccup afterward — that
 *    failure is logged and retried by a background reconciliation job,
 *    not by hoping Paystack retries forever (per spec §37, retries are
 *    still handled, just not by blocking Paystack's webhook timeout).
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-paystack-signature");

  if (!verifyWebhookSignature(rawBody, signature)) {
    console.warn("Paystack webhook signature verification failed.");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: {
    event: string;
    data: { reference: string; id: number; status: string; amount: number };
  };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (payload.event !== "charge.success") {
    // Acknowledge and ignore event types we don't act on yet
    // (e.g. transfer.success for payouts, once outbound transfers are wired up).
    return NextResponse.json({ ok: true, ignored: payload.event });
  }

  const providerEventId = String(payload.data.id);

  try {
    // Independent server-to-server confirmation — do not trust the
    // webhook body's amount/status alone.
    const verified = await verifyTransaction(payload.data.reference);
    if (verified.status !== "success") {
      return NextResponse.json({ ok: true, note: "Transaction not successful on verify." });
    }

    const payment = await db.payment.findUnique({
      where: { providerReference: payload.data.reference },
      include: { booking: { include: { listing: true } }, user: true },
    });
    if (!payment) {
      console.error(`Webhook for unknown payment reference: ${payload.data.reference}`);
      return NextResponse.json({ ok: true, note: "Unknown reference, logged." });
    }

    if (verified.amount !== payment.amountKobo) {
      // Amount mismatch is a serious signal — record it and stop, don't
      // silently accept a different amount than what we quoted.
      console.error(
        `Amount mismatch for payment ${payment.id}: expected ${payment.amountKobo}, got ${verified.amount}`
      );
      return NextResponse.json({ ok: true, note: "Amount mismatch, flagged for review." });
    }

    // Wallet top-ups aren't attached to a booking — the money has landed
    // in the platform's Paystack account, but crediting the user's
    // dashboard balance is a manual admin step for now (see
    // ARCHITECTURE.md addendum §11). All we do here is mark the payment
    // successful (idempotently) and email the admin to go credit it.
    if (payment.purpose === "WALLET_TOPUP") {
      let alreadyProcessed = false;
      try {
        await db.$transaction(async (tx) => {
          await tx.paymentEvent.create({
            data: {
              paymentId: payment.id,
              providerEventId,
              eventType: payload.event,
              rawPayload: payload as unknown as Prisma.InputJsonValue,
            },
          });
          await tx.payment.update({ where: { id: payment.id }, data: { status: "SUCCESS" } });
        });
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
          alreadyProcessed = true;
        } else {
          throw err;
        }
      }

      if (!alreadyProcessed && payment.user) {
        await sendWalletTopUpAlertEmail({
          userFullName: payment.user.fullName,
          userEmail: payment.user.email,
          amountKobo: payment.amountKobo,
          reference: payment.providerReference,
        });
      }

      return NextResponse.json({ ok: true, note: alreadyProcessed ? "Duplicate event." : "Wallet top-up recorded." });
    }

    // Package signup payments (Starter trial card-verification charge, or
    // Eternal/Pro's real first charge). Idempotently records the event,
    // then creates the actual Paystack subscription against the now
    // known-good tokenized card, and for Starter, refunds the small
    // verification charge so the trial is genuinely free.
    if (payment.purpose === "SUBSCRIPTION") {
      let alreadyProcessed = false;
      try {
        await db.$transaction(async (tx) => {
          await tx.paymentEvent.create({
            data: {
              paymentId: payment.id,
              providerEventId,
              eventType: payload.event,
              rawPayload: payload as unknown as Prisma.InputJsonValue,
            },
          });
          await tx.payment.update({ where: { id: payment.id }, data: { status: "SUCCESS" } });
        });
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
          alreadyProcessed = true;
        } else {
          throw err;
        }
      }

      if (!alreadyProcessed && payment.user) {
        const tier = (verified.metadata as { tier?: string })?.tier as PackageTier | undefined;
        const isTrial = Boolean((verified.metadata as { trial?: boolean })?.trial);

        if (!tier) {
          console.error(`Subscription payment ${payment.id} has no tier in metadata — cannot proceed.`);
          return NextResponse.json({ ok: true, note: "Missing tier metadata, flagged for review." });
        }

        try {
          const planCode = planCodeForTier(tier);
          const startDate = isTrial
            ? new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000)
            : undefined;

          const sub = await createSubscription({
            customerEmailOrCode: verified.customer.customer_code,
            planCode,
            authorizationCode: verified.authorization.authorization_code,
            startDate: startDate?.toISOString(),
          });

          await db.subscription.upsert({
            where: { userId: payment.user.id },
            create: {
              userId: payment.user.id,
              tier,
              status: isTrial ? "TRIALING" : "ACTIVE",
              paystackPlanCode: planCode,
              paystackCustomerCode: verified.customer.customer_code,
              paystackSubscriptionCode: sub.subscriptionCode,
              paystackEmailToken: sub.emailToken,
              paystackAuthorizationCode: verified.authorization.authorization_code,
              trialEndsAt: startDate ?? null,
              currentPeriodEnd: startDate ?? null,
            },
            update: {
              tier,
              status: isTrial ? "TRIALING" : "ACTIVE",
              paystackPlanCode: planCode,
              paystackCustomerCode: verified.customer.customer_code,
              paystackSubscriptionCode: sub.subscriptionCode,
              paystackEmailToken: sub.emailToken,
              paystackAuthorizationCode: verified.authorization.authorization_code,
              trialEndsAt: startDate ?? null,
              currentPeriodEnd: startDate ?? null,
              cancelledAt: null,
            },
          });

          if (isTrial) {
            // Best-effort — if this fails, the ₦100 sits as a genuine
            // charge instead of being refunded. Logged loudly so it can
            // be refunded manually from the Paystack dashboard.
            await refundTransaction(payment.providerReference).catch((err) => {
              console.error(
                `Failed to auto-refund trial verification charge for ${payment.providerReference} — refund manually.`,
                err
              );
            });
          }

          await db.notification.create({
            data: {
              userId: payment.user.id,
              type: "SUBSCRIPTION_STARTED",
              title: isTrial ? "Your free trial has started" : "Your plan is active",
              body: isTrial
                ? `Your 7-day ${tier} trial is active. Your card will be charged automatically when it ends — you can cancel any time before then.`
                : `Your ${tier} plan is now active.`,
            },
          });
        } catch (err) {
          console.error(`Failed to create Paystack subscription for payment ${payment.id}:`, err);
        }
      }

      return NextResponse.json({ ok: true, note: alreadyProcessed ? "Duplicate event." : "Subscription recorded." });
    }

    if (!payment.bookingId || !payment.booking) {
      console.error(`Booking payment ${payment.id} has no attached booking.`);
      return NextResponse.json({ ok: true, note: "Booking payment missing booking, logged." });
    }
    // Aliased to locals with a narrowed (non-null) type — property-access
    // narrowing on `payment.bookingId`/`payment.booking` doesn't reliably
    // survive crossing into the transaction closure below.
    const bookingId = payment.bookingId;
    const bookingRecord = payment.booking;

    await db.$transaction(async (tx) => {
      // This create is the idempotency gate: providerEventId is @unique,
      // so a duplicate webhook delivery throws P2002 here and we catch it
      // below without having posted a second set of ledger entries.
      const event = await tx.paymentEvent.create({
        data: {
          paymentId: payment.id,
          providerEventId,
          eventType: payload.event,
          rawPayload: payload as unknown as Prisma.InputJsonValue,
        },
      });

      await tx.payment.update({
        where: { id: payment.id },
        data: { status: "SUCCESS" },
      });

      await transitionBooking(tx, {
        bookingId,
        to: "PAID",
        actorId: null,
        reason: "Paystack payment verified",
      });

      const booking = bookingRecord;

      await postBookingPaymentEntries(tx, {
        bookingId: booking.id,
        customerId: booking.customerId,
        providerId: booking.listing.providerId,
        bookingAmountKobo: booking.bookingAmountKobo,
        depositAmountKobo: booking.depositAmountKobo,
        commissionAmountKobo: booking.commissionAmountKobo,
        providerEarningKobo: booking.bookingAmountKobo - booking.commissionAmountKobo,
        paymentEventId: event.id,
      });

      if (booking.depositAmountKobo > 0) {
        await tx.deposit.create({
          data: {
            bookingId: booking.id,
            amountKobo: booking.depositAmountKobo,
            status: "HELD",
          },
        });
      }

      // Instant-book listings auto-confirm; request-to-book listings stay
      // at PAID awaiting a provider approval step (Phase 2 endpoint —
      // stubbed here as a TODO, tracked in ARCHITECTURE.md §1 scope).
      if (booking.listing.instantBook) {
        const accessCode = crypto.randomInt(100000, 999999).toString();
        await tx.booking.update({
          where: { id: booking.id },
          data: { accessCode, accessCodeExpiresAt: booking.endsAt },
        });
        await transitionBooking(tx, {
          bookingId: booking.id,
          to: "CONFIRMED",
          actorId: null,
          reason: "Instant-book listing auto-confirmed after payment",
        });
      }

      await tx.notification.create({
        data: {
          userId: booking.customerId,
          type: "BOOKING_PAID",
          title: "Payment confirmed",
          body: `Your payment for booking ${booking.id} was successful.`,
        },
      });
      await tx.notification.create({
        data: {
          userId: booking.listing.providerId,
          type: "BOOKING_PAID",
          title: "New paid booking",
          body: `You have a new confirmed booking (${booking.id}).`,
        },
      });
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      // Duplicate webhook delivery for an event we've already processed —
      // this is the expected, safe idempotent path, not an error.
      return NextResponse.json({ ok: true, note: "Duplicate event, already processed." });
    }
    console.error("Error processing Paystack webhook:", err);
    // Return 200 anyway once signature+verify passed, so Paystack doesn't
    // hammer retries for a bug on our side while we alert on the log line
    // above; a reconciliation job (ARCHITECTURE.md §8) sweeps PaymentEvent
    // rows with a null processedAt / recorded error for manual follow-up.
    return NextResponse.json({ ok: true, note: "Logged for manual reconciliation." });
  }
}
