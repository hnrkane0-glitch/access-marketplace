import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handleApiError, userError } from "@/lib/api-error";
import { disableSubscription } from "@/lib/paystack";

export async function POST() {
  try {
    const user = await requireUser();
    const subscription = await db.subscription.findUnique({ where: { userId: user.id } });
    if (!subscription) throw userError("You don't have a plan to cancel.");
    if (subscription.status === "CANCELLED") throw userError("Already cancelled.");

    if (subscription.paystackSubscriptionCode) {
      if (subscription.paystackEmailToken) {
        try {
          await disableSubscription({
            subscriptionCode: subscription.paystackSubscriptionCode,
            emailToken: subscription.paystackEmailToken,
          });
        } catch (err) {
          console.error(
            `Failed to disable Paystack subscription ${subscription.paystackSubscriptionCode} — cancel it manually from the Paystack dashboard.`,
            err
          );
        }
      } else {
        console.error(
          `Subscription ${subscription.id} has no stored email_token — cancel ${subscription.paystackSubscriptionCode} manually from the Paystack dashboard.`
        );
      }
    }

    await db.subscription.update({
      where: { userId: user.id },
      data: { status: "CANCELLED", cancelledAt: new Date() },
    });

    await db.notification.create({
      data: {
        userId: user.id,
        type: "SUBSCRIPTION_CANCELLED",
        title: "Plan cancelled",
        body: "Your subscription has been cancelled. Your card will not be charged again.",
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
