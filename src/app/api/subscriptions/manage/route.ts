import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handleApiError, userError } from "@/lib/api-error";

export async function GET() {
  try {
    const user = await requireUser();
    const sub = await db.accountSubscription.findFirst({
      where: { userId: user.id, status: { in: ["TRIALING", "ACTIVE"] }, paystackSubscriptionCode: { not: null } },
      orderBy: { createdAt: "desc" },
    });
    const key = process.env.PAYSTACK_SECRET_KEY;
    if (!key) throw new Error("PAYSTACK_SECRET_KEY is not set.");
    let subscriptionCode = sub?.paystackSubscriptionCode;
    if (!subscriptionCode && sub?.paystackCustomerCode) {
      const listRes = await fetch(`https://api.paystack.co/subscription?customer=${encodeURIComponent(sub.paystackCustomerCode)}`, {
        headers: { Authorization: `Bearer ${key}` },
      });
      const listJson = await listRes.json();
      const found = Array.isArray(listJson.data)
        ? listJson.data.find((x: { plan?: { plan_code?: string }; status?: string }) =>
            x.plan?.plan_code === sub.planCode && ["active", "attention"].includes(String(x.status).toLowerCase())
          )
        : null;
      subscriptionCode = found?.subscription_code;
      if (subscriptionCode) {
        await db.accountSubscription.update({ where: { id: sub.id }, data: { paystackSubscriptionCode: subscriptionCode } });
      }
    }
    if (!subscriptionCode) throw userError("No active Paystack subscription found.");
    const res = await fetch(`https://api.paystack.co/subscription/${encodeURIComponent(subscriptionCode)}/manage/link`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    const json = await res.json();
    if (!res.ok || !json.status) throw new Error(json.message ?? "Could not create subscription management link.");
    return NextResponse.json({ link: json.data.link });
  } catch (err) {
    return handleApiError(err);
  }
}
