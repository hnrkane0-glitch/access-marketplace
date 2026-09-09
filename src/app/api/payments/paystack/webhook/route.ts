import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyWebhookSignature, verifyTransaction, refundTransaction, createSubscription } from "@/lib/paystack";
import { transitionBooking } from "@/lib/booking-state-machine";
import { postBookingPaymentEntries } from "@/lib/ledger";
import { Prisma } from "@prisma/client";
import crypto from "crypto";
import { sendAdminEmail, nairaEmail } from "@/lib/email";

function metaString(meta: Record<string, unknown> | undefined, key: string) {
  return typeof meta?.[key] === "string" ? meta[key] as string : undefined;
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  if (!verifyWebhookSignature(rawBody, req.headers.get("x-paystack-signature"))) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: { event: string; data: { reference: string; id: number; status: string; amount: number } };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (payload.event === "subscription.disable" || payload.event === "subscription.not_renew") {
    const code = (payload.data as unknown as { subscription_code?: string }).subscription_code;
    if (code) {
      await db.accountSubscription.updateMany({
        where: { paystackSubscriptionCode: code },
        data: { status: payload.event === "subscription.disable" ? "CANCELLED" : "PAST_DUE" },
      });
    }
    return NextResponse.json({ ok: true });
  }

  if (payload.event !== "charge.success") {
    return NextResponse.json({ ok: true, ignored: payload.event });
  }

  try {
    const verified = await verifyTransaction(payload.data.reference);
    if (verified.status !== "success") return NextResponse.json({ ok: true });

    const metadata = verified.metadata ?? {};

    // MANUAL WALLET TOP-UP: payment goes to the platform Paystack account.
    // It is intentionally NOT auto-credited. Admin receives an email and
    // manually credits the exact amount from /admin/send-money.
    if (metaString(metadata, "type") === "WALLET_TOPUP") {
      const topup = await db.walletTopup.findUnique({
        where: { providerReference: payload.data.reference },
        include: { user: { select: { fullName: true, email: true } } },
      });
      if (!topup) return NextResponse.json({ ok: true, note: "Unknown wallet topup." });
      if (verified.amount !== topup.amountKobo) return NextResponse.json({ ok: true, note: "Topup amount mismatch." });

      if (topup.status === "PENDING") {
        await db.$transaction(async (tx) => {
          await tx.walletTopup.update({
            where: { id: topup.id },
            data: { status: "PAID", paidAt: new Date() },
          });
          await tx.notification.create({
            data: {
              userId: topup.userId,
              type: "WALLET_TOPUP_PAID",
              title: "Top-up received — processing",
              body: `${nairaEmail(topup.amountKobo)} was received by the platform. Your dashboard will be credited manually after we confirm it. This can take a few minutes.`,
            },
          });
        });

        await sendAdminEmail(
          `Wallet top-up received — ${nairaEmail(topup.amountKobo)}`,
          `<h2>Manual wallet credit required</h2>
           <p><strong>${topup.user.fullName}</strong> (${topup.user.email}) paid <strong>${nairaEmail(topup.amountKobo)}</strong>.</p>
           <p>Paystack reference: <strong>${topup.providerReference}</strong></p>
           <p>Open the admin dashboard → Send money and credit the exact amount to this user's email.</p>`
        );
      }
      return NextResponse.json({ ok: true });
    }

    // STARTER: verify card with a refundable ₦100 charge, then schedule the
    // real Paystack subscription to begin 7 days later. Paystack currently
    // does not provide a native free-trial field.
    if (metaString(metadata, "type") === "STARTER_CARD_VERIFICATION") {
      const userId = metaString(metadata, "userId");
      const planCode = metaString(metadata, "planCode");
      if (!userId || !planCode) return NextResponse.json({ ok: true });

      const sub = await db.accountSubscription.findFirst({
        where: { userId, planCode, status: "PENDING" },
        orderBy: { createdAt: "desc" },
      });
      if (!sub) return NextResponse.json({ ok: true });

      const customerCode = verified.customer?.customer_code;
      const authorizationCode = verified.authorization?.authorization_code;
      if (!customerCode || !authorizationCode) {
        await sendAdminEmail(
          "Starter subscription needs attention",
          `<p>Starter card verification succeeded for ${userId}, but Paystack did not return a reusable authorization code.</p>`
        );
        return NextResponse.json({ ok: true });
      }

      const trialEnds = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const scheduled = await createSubscription({
        customerCode,
        planCode,
        authorizationCode,
        startDate: trialEnds.toISOString(),
      });

      await db.accountSubscription.update({
        where: { id: sub.id },
        data: {
          status: "TRIALING",
          trialEndsAt: trialEnds,
          currentPeriodEnd: trialEnds,
          paystackCustomerCode: customerCode,
          paystackAuthorizationCode: authorizationCode,
          paystackSubscriptionCode: scheduled.subscription_code,
          lastReference: payload.data.reference,
        },
      });

      // Refund the temporary verification charge so the trial remains free.
      await refundTransaction(payload.data.reference, verified.amount);
      await db.user.update({ where: { id: userId }, data: { updatedAt: new Date() } });

      return NextResponse.json({ ok: true });
    }

    // ETERNAL / PRO plan purchase. Paystack creates the recurring subscription
    // automatically because plan_code was supplied during initialization.
    if (metaString(metadata, "type") === "SUBSCRIPTION_PLAN") {
      const userId = metaString(metadata, "userId");
      const tier = metaString(metadata, "tier") as "ETERNAL" | "PRO" | undefined;
      const planCode = metaString(metadata, "planCode");
      if (userId && tier && planCode) {
        const sub = await db.accountSubscription.findFirst({
          where: { userId, tier, planCode, status: "PENDING" },
          orderBy: { createdAt: "desc" },
        });
        if (sub) {
          await db.accountSubscription.update({
            where: { id: sub.id },
            data: {
              status: "ACTIVE",
              currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
              paystackCustomerCode: verified.customer?.customer_code,
              paystackAuthorizationCode: verified.authorization?.authorization_code,
              lastReference: payload.data.reference,
            },
          });
          await db.notification.create({
            data: {
              userId,
              type: "SUBSCRIPTION_ACTIVE",
              title: `${tier} plan activated`,
              body: `Your ${tier} membership is now active. You can manage or cancel your card subscription from your account settings.`,
            },
          });
        }
      }
      return NextResponse.json({ ok: true });
    }

    // Normal booking payment flow.
    const payment = await db.payment.findUnique({
      where: { providerReference: payload.data.reference },
      include: { booking: { include: { listing: true } } },
    });
    if (!payment?.booking) return NextResponse.json({ ok: true, note: "Unknown reference." });

    if (verified.amount !== payment.amountKobo) {
      console.error(`Amount mismatch for payment ${payment.id}: expected ${payment.amountKobo}, got ${verified.amount}`);
      return NextResponse.json({ ok: true, note: "Amount mismatch, flagged." });
    }

    await db.$transaction(async (tx) => {
      const event = await tx.paymentEvent.create({
        data: {
          paymentId: payment.id,
          providerEventId: String(payload.data.id),
          eventType: payload.event,
          rawPayload: payload as unknown as Prisma.InputJsonValue,
        },
      });

      await tx.payment.update({ where: { id: payment.id }, data: { status: "SUCCESS" } });
      await transitionBooking(tx, {
        bookingId: payment.bookingId!,
        to: "PAID",
        actorId: null,
        reason: "Paystack payment verified",
      });

      const booking = payment.booking!;
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
          data: { bookingId: booking.id, amountKobo: booking.depositAmountKobo, status: "HELD" },
        });
      }

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
          body: `You have a new paid booking (${booking.id}).`,
        },
      });
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ ok: true, note: "Duplicate event." });
    }
    console.error("Paystack webhook error:", err);
    return NextResponse.json({ ok: true, note: "Logged for reconciliation." });
  }
}
