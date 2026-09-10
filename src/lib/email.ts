import { Resend } from "resend";

/**
 * All money movement on this platform is manual for now (see
 * ARCHITECTURE.md addendum §11): a user pays into the platform's own
 * Paystack account, or asks to be paid out of it, and a human admin
 * carries out the actual transfer from the Paystack dashboard. This file
 * is the notification layer that tells the admin ("hnrkane0@gmail.com"
 * by default, overridable via ADMIN_NOTIFICATION_EMAIL) that action is
 * needed, with exactly the details they need to act — nothing more.
 *
 * This never throws into the caller's request/transaction: a failed
 * notification email must not roll back a successful payment or a
 * recorded withdrawal request. Every call is wrapped and logged instead.
 */

function adminEmail(): string {
  return process.env.ADMIN_NOTIFICATION_EMAIL?.trim() || "hnrkane0@gmail.com";
}

function fromAddress(): string {
  // Resend requires sending from a domain you've verified with them.
  // Falls back to their shared sandbox sender so this doesn't hard-crash
  // before the admin has verified a domain — but real delivery to
  // non-test inboxes needs EMAIL_FROM set to an address on a verified
  // domain. See https://resend.com/docs/dashboard/domains/introduction
  return process.env.EMAIL_FROM?.trim() || "Access Marketplace <onboarding@resend.dev>";
}

function client(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.error(
      "RESEND_API_KEY is not set — admin notification email was skipped. " +
        "Set it in your environment for top-up/withdrawal alerts to actually send."
    );
    return null;
  }
  return new Resend(key);
}

function naira(kobo: number): string {
  return `₦${(kobo / 100).toLocaleString()}`;
}

async function send(subject: string, html: string, text: string) {
  const resend = client();
  if (!resend) return;
  try {
    await resend.emails.send({
      from: fromAddress(),
      to: adminEmail(),
      subject,
      html,
      text,
    });
  } catch (err) {
    // Deliberately swallowed — see file header. The Payment/Withdrawal
    // row is still the source of truth and is visible in /admin either
    // way, so a missed email is an inconvenience, not data loss.
    console.error("Failed to send admin notification email:", err);
  }
}

export async function sendWalletTopUpAlertEmail(params: {
  userFullName: string;
  userEmail: string;
  amountKobo: number;
  reference: string;
}) {
  const amount = naira(params.amountKobo);
  await send(
    `💰 Wallet top-up received — ${amount} from ${params.userFullName}`,
    `
      <div style="font-family: sans-serif; line-height: 1.6;">
        <h2>New wallet top-up — action needed</h2>
        <p><strong>${params.userFullName}</strong> (${params.userEmail}) just paid
        <strong>${amount}</strong> into the platform's Paystack account to top up
        their dashboard balance.</p>
        <p><strong>Next step:</strong> go to the admin console →
        <a href="${process.env.NEXT_PUBLIC_APP_URL ?? ""}/admin/send-money">Send money</a>
        and credit <strong>${params.userEmail}</strong> with <strong>${amount}</strong>
        so it shows up on their dashboard.</p>
        <p style="color:#666; font-size: 13px;">Paystack reference: ${params.reference}</p>
      </div>
    `,
    `New wallet top-up: ${params.userFullName} (${params.userEmail}) paid ${amount}. ` +
      `Reference: ${params.reference}. Credit them the same amount via /admin/send-money.`
  );
}

export async function sendWithdrawalAlertEmail(params: {
  userFullName: string;
  userEmail: string;
  amountKobo: number;
  bankName?: string | null;
  bankCode: string;
  accountNumber: string;
  accountName?: string | null;
  source: "WALLET" | "PROVIDER_EARNINGS";
}) {
  const amount = naira(params.amountKobo);
  const sourceLabel = params.source === "WALLET" ? "wallet balance" : "provider earnings";
  await send(
    `🏦 Withdrawal requested — ${amount} for ${params.userFullName}`,
    `
      <div style="font-family: sans-serif; line-height: 1.6;">
        <h2>Pending withdrawal — action needed</h2>
        <p><strong>${params.userFullName}</strong> (${params.userEmail}) requested a
        withdrawal of <strong>${amount}</strong> from their ${sourceLabel}.</p>
        <table style="border-collapse: collapse; margin-top: 8px;">
          <tr><td style="padding:4px 12px 4px 0; color:#666;">Bank</td><td>${params.bankName ?? params.bankCode}</td></tr>
          <tr><td style="padding:4px 12px 4px 0; color:#666;">Account number</td><td>${params.accountNumber}</td></tr>
          <tr><td style="padding:4px 12px 4px 0; color:#666;">Account name</td><td>${params.accountName ?? "—"}</td></tr>
        </table>
        <p style="margin-top:12px;"><strong>Next step:</strong> send ${amount} to the account
        above from Paystack, then mark it complete in the
        <a href="${process.env.NEXT_PUBLIC_APP_URL ?? ""}/admin/withdrawals">admin withdrawals</a> page.</p>
      </div>
    `,
    `Withdrawal requested: ${params.userFullName} (${params.userEmail}) wants ${amount} from their ${sourceLabel}. ` +
      `Bank: ${params.bankName ?? params.bankCode}, Account: ${params.accountNumber} (${params.accountName ?? "—"}). ` +
      `Send it via Paystack, then mark complete in /admin/withdrawals.`
  );
}
