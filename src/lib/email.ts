const DEFAULT_ADMIN_EMAIL = "hnrkane0@gmail.com";

function adminEmail() {
  return process.env.ADMIN_NOTIFICATION_EMAIL || DEFAULT_ADMIN_EMAIL;
}

export async function sendAdminEmail(subject: string, html: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn(`[email] RESEND_API_KEY missing; admin email not sent: ${subject}`);
    return { sent: false };
  }

  const from = process.env.RESEND_FROM_EMAIL || "Access Marketplace <onboarding@resend.dev>";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to: [adminEmail()], subject, html }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error("[email] Resend error:", body);
    return { sent: false };
  }
  return { sent: true };
}

export function nairaEmail(kobo: number) {
  return `₦${(kobo / 100).toLocaleString("en-NG", { maximumFractionDigits: 2 })}`;
}

export { adminEmail };
