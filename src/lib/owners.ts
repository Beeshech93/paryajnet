/**
 * Owner e-mails (OWNER_EMAILS, comma-separated, set in the hosting settings).
 * An account with one of these e-mails becomes admin without another admin's
 * approval — but only after proving it controls the mailbox (e-mailed link),
 * so nobody else can sign up with the owner's address and take over.
 */
export function isOwnerEmail(email: string) {
  const owners = (process.env.OWNER_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return owners.includes(email.trim().toLowerCase());
}
