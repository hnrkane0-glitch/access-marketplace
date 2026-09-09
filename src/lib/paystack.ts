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
  planCode?: string;
  channels?: string[];
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
      ...(params.planCode ? { plan: params.planCode } : {}),
      ...(params.channels ? { channels: params.channels } : {}),
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
    customer?: { customer_code?: string };
    authorization?: { authorization_code?: string; channel?: string; reusable?: boolean };
    id: number; // Paystack's numeric transaction id — used as the idempotency key
  };
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


export async function refundTransaction(reference: string, amountKobo?: number) {
  const body: Record<string, unknown> = { transaction: reference };
  if (amountKobo) body.amount = amountKobo;
  const res = await fetch(`${PAYSTACK_BASE_URL}/refund`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requireSecretKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok || !json.status) throw new Error(`Paystack refund failed: ${json.message ?? res.statusText}`);
  return json.data;
}

export async function createSubscription(params: {
  customerCode: string;
  planCode: string;
  authorizationCode: string;
  startDate?: string;
}) {
  const res = await fetch(`${PAYSTACK_BASE_URL}/subscription`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requireSecretKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      customer: params.customerCode,
      plan: params.planCode,
      authorization: params.authorizationCode,
      ...(params.startDate ? { start_date: params.startDate } : {}),
    }),
  });
  const json = await res.json();
  if (!res.ok || !json.status) throw new Error(`Paystack subscription failed: ${json.message ?? res.statusText}`);
  return json.data as { subscription_code: string; email_token: string; status: string };
}
