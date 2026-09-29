/**
 * Transactional e-mail through Resend (https://resend.com), configured with
 * RESEND_API_KEY and MAIL_FROM (a sender on a domain verified in Resend).
 * Without them, e-mail is disabled and callers fall back to other channels.
 */
export function mailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.MAIL_FROM);
}

export async function sendMail(to: string, subject: string, text: string, html: string): Promise<boolean> {
  if (!mailConfigured()) {
    console.warn("[mail] not configured (RESEND_API_KEY / MAIL_FROM); skipped:", subject);
    return false;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.MAIL_FROM, to: [to], subject, text, html }),
    });
    if (!res.ok) console.error("[mail] Resend", res.status, (await res.text()).slice(0, 300));
    return res.ok;
  } catch (err) {
    console.error("[mail] failed", err);
    return false;
  }
}
