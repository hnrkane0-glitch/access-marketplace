import crypto from "crypto";

const PAYSTACK_BASE_URL = "https://api.paystack.co";

function requireSecretKey(): string {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) {
    throw new Error("PAYSTACK_SECRET_KEY is not set in the environment.");
  }
  return key;
}

interface InitializeTransactionParams {
  email: string;
  amountKobo: number; // Paystack's NGN amounts are in kobo already — no conversion needed
  reference: string;
  callbackUrl: string;
  metadata?: Record<string, unknown>;
}

interface InitializeTransactionResult {
  authorizationUrl: string;
  accessCode: string;
  reference: string;
}

/**
 * Starts a Paystack transaction server-side. The amount here MUST come
 * from a freshly-read Booking row (see pricing.ts), never from the
 * request body — see ARCHITECTURE.md §2.
 */
export async function initializeTransaction(
  params: InitializeTransactionParams
): Promise<InitializeTransactionResult> {
  const res = await fetch(`${PAYSTACK_BASE_URL}/transaction/initialize`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requireSecretKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: params.email,
      amount: params.amountKobo,
      reference: params.reference,
      callback_url: params.callbackUrl,
      metadata: params.metadata ?? {},
    }),
  });

  const json = await res.json();
  if (!res.ok || !json.status) {
    throw new Error(`Paystack initialize failed: ${json.message ?? res.statusText}`);
  }

  return {
    authorizationUrl: json.data.authorization_url,
    accessCode: json.data.access_code,
    reference: json.data.reference,
  };
}

/**
 * Independently re-verifies a transaction against Paystack's API. Used as
 * a belt-and-braces check inside the webhook handler in addition to
 * signature verification — we don't act on the webhook payload's amount
 * field alone, we confirm it against a live GET to Paystack.
 */
export async function verifyTransaction(reference: string) {
  const res = await fetch(
    `${PAYSTACK_BASE_URL}/transaction/verify/${encodeURIComponent(reference)}`,
    {
      headers: { Authorization: `Bearer ${requireSecretKey()}` },
    }
  );
  const json = await res.json();
  if (!res.ok || !json.status) {
    throw new Error(`Paystack verify failed: ${json.message ?? res.statusText}`);
  }
  return json.data as {
    status: "success" | "failed" | "abandoned";
    reference: string;
    amount: number;
    currency: string;
    metadata: Record<string, unknown>;
    id: number; // Paystack's numeric transaction id — used as the idempotency key
    plan: string | null;
    customer: { customer_code: string; email: string };
    authorization: {
      authorization_code: string;
      last4: string;
      exp_month: string;
      exp_year: string;
      card_type: string;
      bank: string;
      reusable: boolean;
    };
  };
}

/** Looks up a plan's configured price/interval from Paystack — used so we
 * never hardcode Starter/Eternal/Pro prices in this codebase; the
 * Paystack dashboard is the single source of truth for pricing. */
export async function fetchPlan(planCode: string): Promise<{
  amountKobo: number;
  interval: string;
  name: string;
}> {
  const res = await fetch(`${PAYSTACK_BASE_URL}/plan/${encodeURIComponent(planCode)}`, {
    headers: { Authorization: `Bearer ${requireSecretKey()}` },
  });
  const json = await res.json();
  if (!res.ok || !json.status) {
    throw new Error(`Paystack fetch-plan failed for ${planCode}: ${json.message ?? res.statusText}`);
  }
  return {
    amountKobo: json.data.amount,
    interval: json.data.interval,
    name: json.data.name,
  };
}

interface CreateSubscriptionParams {
  customerEmailOrCode: string;
  planCode: string;
  authorizationCode: string;
  /** ISO string — delays the first recurring charge to this date. Omit
   * to bill immediately (used for Eternal/Pro, which don't have a trial). */
  startDate?: string;
}

interface CreateSubscriptionResult {
  subscriptionCode: string;
  emailToken: string;
}

/**
 * Creates a Paystack subscription against an already-tokenized card
 * (from a prior transaction's `authorization.authorization_code`).
 * Passing `startDate` in the future is how the Starter package's 7-day
 * free trial works — the card is verified now, but Paystack doesn't
 * attempt its first real charge until then.
 * Docs: https://paystack.com/docs/payments/subscriptions/
 */
export async function createSubscription(
  params: CreateSubscriptionParams
): Promise<CreateSubscriptionResult> {
  const res = await fetch(`${PAYSTACK_BASE_URL}/subscription`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requireSecretKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      customer: params.customerEmailOrCode,
      plan: params.planCode,
      authorization: params.authorizationCode,
      ...(params.startDate ? { start_date: params.startDate } : {}),
    }),
  });
  const json = await res.json();
  if (!res.ok || !json.status) {
    throw new Error(`Paystack create-subscription failed: ${json.message ?? res.statusText}`);
  }
  return {
    subscriptionCode: json.data.subscription_code,
    emailToken: json.data.email_token,
  };
}

/**
 * Refunds a transaction. Used only for the Starter trial's small
 * card-verification charge (Paystack has no true ₦0 auth in NGN) — we
 * charge a small amount to tokenize the card, then immediately refund it
 * so the trial is genuinely free.
 */
export async function refundTransaction(reference: string): Promise<void> {
  const res = await fetch(`${PAYSTACK_BASE_URL}/refund`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requireSecretKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ transaction: reference }),
  });
  const json = await res.json();
  if (!res.ok || !json.status) {
    throw new Error(`Paystack refund failed: ${json.message ?? res.statusText}`);
  }
}

/** Cancels a subscription. `emailToken` comes from createSubscription's result. */
export async function disableSubscription(params: {
  subscriptionCode: string;
  emailToken: string;
}): Promise<void> {
  const res = await fetch(`${PAYSTACK_BASE_URL}/subscription/disable`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requireSecretKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ code: params.subscriptionCode, token: params.emailToken }),
  });
  const json = await res.json();
  if (!res.ok || !json.status) {
    throw new Error(`Paystack disable-subscription failed: ${json.message ?? res.statusText}`);
  }
}

/**
 * Verifies the `x-paystack-signature` header. Paystack signs the raw
 * request body with your secret key using HMAC-SHA512 — this MUST run
 * before the webhook handler parses/trusts the payload at all.
 * See: https://paystack.com/docs/payments/webhooks/
 */
export function verifyWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
  if (!signatureHeader) return false;
  const expected = crypto
    .createHmac("sha512", requireSecretKey())
    .update(rawBody)
    .digest("hex");
  // Constant-time comparison to avoid timing side-channels.
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signatureHeader, "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
