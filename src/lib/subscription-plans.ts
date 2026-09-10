export type PackageTier = "STARTER" | "ETERNAL" | "PRO";

export const TRIAL_DAYS = 7;

// A nominal, fully-refunded charge used only to tokenize the card for
// Starter's free trial — Paystack has no true ₦0 authorization in NGN.
export const TRIAL_CARD_VERIFY_KOBO = 100_00; // ₦100

export function planCodeForTier(tier: PackageTier): string {
  const map: Record<PackageTier, string | undefined> = {
    STARTER: process.env.PAYSTACK_PLAN_STARTER,
    ETERNAL: process.env.PAYSTACK_PLAN_ETERNAL,
    PRO: process.env.PAYSTACK_PLAN_PRO,
  };
  const code = map[tier];
  if (!code) {
    throw new Error(`PAYSTACK_PLAN_${tier} is not set in the environment.`);
  }
  return code;
}

export function tierForPlanCode(planCode: string): PackageTier | null {
  if (planCode === process.env.PAYSTACK_PLAN_STARTER) return "STARTER";
  if (planCode === process.env.PAYSTACK_PLAN_ETERNAL) return "ETERNAL";
  if (planCode === process.env.PAYSTACK_PLAN_PRO) return "PRO";
  return null;
}

export const TIER_LABELS: Record<PackageTier, string> = {
  STARTER: "Starter",
  ETERNAL: "Eternal",
  PRO: "Pro",
};
