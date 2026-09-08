import { DepositMode, Listing, ListingDepositRule, ListingPriceRule, PriceRuleScope, PriceUnit } from "@prisma/client";
import { getCommissionBpsForProvider } from "@/lib/platform-settings";

export interface PriceComputation {
  bookingAmountKobo: number;
  depositAmountKobo: number;
  commissionAmountKobo: number;
  providerEarningKobo: number;
  totalAmountKobo: number;
  breakdown: {
    unit: PriceUnit;
    unitAmountKobo: number;
    units: number;
    scope: PriceRuleScope;
  };
}

function isWeekend(date: Date): boolean {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

function unitsBetween(unit: PriceUnit, startsAt: Date, endsAt: Date, quantity: number): number {
  const ms = endsAt.getTime() - startsAt.getTime();
  const hours = ms / (1000 * 60 * 60);
  switch (unit) {
    case "HOURLY":
      return Math.max(1, Math.ceil(hours));
    case "DAILY":
      return Math.max(1, Math.ceil(hours / 24));
    case "WEEKLY":
      return Math.max(1, Math.ceil(hours / (24 * 7)));
    case "MONTHLY":
      return Math.max(1, Math.ceil(hours / (24 * 30)));
    case "PER_PERSON":
    case "PER_UNIT":
    case "PER_SESSION":
      return Math.max(1, quantity);
    default:
      return 1;
  }
}

/**
 * Picks the most specific applicable price rule. Precedence, most to
 * least specific: SEASONAL (date-ranged) > WEEKEND > BASE. This function
 * is intentionally simple for Phase 1 — PEAK/EARLY_BOOKING_DISCOUNT/
 * LAST_MINUTE are modeled in the schema but not yet auto-selected here;
 * they can be applied as explicit promo codes in a later phase without
 * changing this function's contract.
 */
function selectPriceRule(
  rules: ListingPriceRule[],
  startsAt: Date
): ListingPriceRule {
  const seasonal = rules.find(
    (r) =>
      r.appliesTo === "SEASONAL" &&
      r.startDate &&
      r.endDate &&
      startsAt >= r.startDate &&
      startsAt <= r.endDate
  );
  if (seasonal) return seasonal;

  if (isWeekend(startsAt)) {
    const weekend = rules.find((r) => r.appliesTo === "WEEKEND");
    if (weekend) return weekend;
  }

  const base = rules.find((r) => r.appliesTo === "BASE");
  if (!base) {
    throw new Error("Listing has no BASE price rule configured.");
  }
  return base;
}

function computeDeposit(rule: ListingDepositRule | null, bookingAmountKobo: number): number {
  if (!rule || rule.mode === DepositMode.NONE) return 0;
  if (rule.mode === DepositMode.FIXED) return rule.fixedKobo ?? 0;
  if (rule.mode === DepositMode.PERCENT) {
    return Math.round((bookingAmountKobo * (rule.percentBps ?? 0)) / 10_000);
  }
  return 0;
}

export async function computeBookingPrice(params: {
  listing: Listing & {
    priceRules: ListingPriceRule[];
    depositRule: ListingDepositRule | null;
  };
  providerCommissionOverrideBps: number | null;
  startsAt: Date;
  endsAt: Date;
  quantity: number;
}): Promise<PriceComputation> {
  const { listing, startsAt, endsAt, quantity } = params;

  if (endsAt <= startsAt) {
    throw new Error("endsAt must be after startsAt.");
  }
  const minutes = (endsAt.getTime() - startsAt.getTime()) / (1000 * 60);
  if (minutes < listing.minBookingMinutes) {
    throw new Error(`Booking must be at least ${listing.minBookingMinutes} minutes.`);
  }
  if (listing.maxBookingMinutes && minutes > listing.maxBookingMinutes) {
    throw new Error(`Booking cannot exceed ${listing.maxBookingMinutes} minutes.`);
  }

  const rule = selectPriceRule(listing.priceRules, startsAt);
  const units = unitsBetween(rule.unit, startsAt, endsAt, quantity);
  const bookingAmountKobo = rule.amountKobo * units;

  const depositAmountKobo = computeDeposit(listing.depositRule, bookingAmountKobo);

  const commissionBps = await getCommissionBpsForProvider(params.providerCommissionOverrideBps);
  const commissionAmountKobo = Math.round((bookingAmountKobo * commissionBps) / 10_000);
  const providerEarningKobo = bookingAmountKobo - commissionAmountKobo;

  const totalAmountKobo = bookingAmountKobo + depositAmountKobo;

  return {
    bookingAmountKobo,
    depositAmountKobo,
    commissionAmountKobo,
    providerEarningKobo,
    totalAmountKobo,
    breakdown: {
      unit: rule.unit,
      unitAmountKobo: rule.amountKobo,
      units,
      scope: rule.appliesTo,
    },
  };
}
