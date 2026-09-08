import { db } from "@/lib/db";

/**
 * Defaults used only if the admin hasn't set a PlatformSetting row yet
 * (e.g. right after a fresh install). Once an admin edits a setting via
 * /admin/settings, the DB value takes over. Nothing here should be
 * imported directly by business logic — always go through getSetting().
 */
const DEFAULTS: Record<string, unknown> = {
  platformCommissionBps: 1000, // 10%
  payoutHoldDays: 5,
  minWithdrawalKobo: 500_000, // ₦5,000
  defaultCancellationPolicy: "MODERATE",
  supportedCurrencies: ["NGN"],
};

export async function getSetting<T>(key: string): Promise<T> {
  const row = await db.platformSetting.findUnique({ where: { key } });
  if (row) return row.value as T;
  if (key in DEFAULTS) return DEFAULTS[key] as T;
  throw new Error(`Unknown platform setting: ${key}`);
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await db.platformSetting.upsert({
    where: { key },
    create: { key, value: value as never },
    update: { value: value as never },
  });
}

/** Provider-specific commission overrides the platform default when set. */
export async function getCommissionBpsForProvider(
  providerCommissionOverride: number | null
): Promise<number> {
  if (providerCommissionOverride != null) return providerCommissionOverride;
  return getSetting<number>("platformCommissionBps");
}
