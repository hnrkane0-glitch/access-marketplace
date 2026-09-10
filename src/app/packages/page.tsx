import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { fetchPlan } from "@/lib/paystack";
import { planCodeForTier, type PackageTier } from "@/lib/subscription-plans";
import PackagePicker from "./package-picker";

function naira(kobo: number): string {
  return `₦${(kobo / 100).toLocaleString()}`;
}

const TIERS: PackageTier[] = ["STARTER", "ETERNAL", "PRO"];

export default async function PackagesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const existing = await db.subscription.findUnique({ where: { userId: user.id } });
  if (existing && (existing.status === "ACTIVE" || existing.status === "TRIALING")) {
    redirect(user.isProvider ? "/provider/dashboard" : "/dashboard");
  }

  const plans = await Promise.all(
    TIERS.map(async (tier) => {
      try {
        const code = planCodeForTier(tier);
        const plan = await fetchPlan(code);
        return { tier, priceLabel: naira(plan.amountKobo), interval: plan.interval, available: true };
      } catch {
        // Missing env var or Paystack not reachable (e.g. local dev
        // without keys configured yet) — still render the page.
        return { tier, priceLabel: "—", interval: "month", available: false };
      }
    })
  );

  return (
    <div className="mx-auto max-w-5xl px-5 py-16">
      <div className="text-center max-w-xl mx-auto">
        <h1 className="text-3xl font-semibold tracking-tight">Choose your plan</h1>
        <p className="mt-2 text-[var(--ink-soft)]">
          Pick a package to activate your account. Starter includes a 7-day free trial — you&apos;ll
          still need to add a card, but you won&apos;t be charged until the trial ends, and you can
          cancel any time before then.
        </p>
      </div>
      <PackagePicker plans={plans} />
    </div>
  );
}
