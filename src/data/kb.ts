// Knowledge base for "Ledgerly", a fictional invoicing SaaS. Synthetic on purpose:
// the model cannot answer from memory, so retrieval is actually exercised.

export interface KbArticle {
  id: string;
  title: string;
  keywords: string[];
  body: string;
}

export const KB: KbArticle[] = [
  {
    id: "KB-101",
    title: "Resetting your password and unlocking your account",
    keywords: ["password", "reset", "locked", "login", "sign in", "lockout", "unlock"],
    body: "Accounts lock after 5 failed sign-ins. Use 'Forgot password' on the sign-in page; the reset link expires after 30 minutes. Locked accounts unlock automatically after 1 hour.",
  },
  {
    id: "KB-102",
    title: "Two-factor authentication (2FA) recovery",
    keywords: ["2fa", "two-factor", "authenticator", "recovery code", "mfa", "lost phone"],
    body: "Use one of your 10 recovery codes. If you have none, the account owner must verify identity with support; support never disables 2FA over chat or email alone.",
  },
  {
    id: "KB-201",
    title: "Understanding your invoice and billing cycle",
    keywords: ["invoice", "charge", "billing", "billed", "cycle", "statement", "prorated", "proration"],
    body: "Plans bill on the signup anniversary. Mid-cycle upgrades are prorated to the day. Downgrades take effect at the next cycle.",
  },
  {
    id: "KB-202",
    title: "Refund policy",
    keywords: ["refund", "money back", "double charged", "charged twice", "duplicate charge", "cancel"],
    body: "Duplicate charges are reviewed by the billing team within 3 business days. Agents must not promise or confirm a refund; route to billing for review.",
  },
  {
    id: "KB-203",
    title: "Updating payment methods",
    keywords: ["card", "payment method", "credit card", "expired card", "declined", "update card"],
    body: "Account owners can update the card under Settings > Billing. Failed payments retry on days 1, 3 and 7.",
  },
  {
    id: "KB-301",
    title: "Invoice PDFs not generating",
    keywords: ["pdf", "export", "download", "blank", "generating", "stuck", "spinner"],
    body: "Known issue INC-4471: PDFs over 200 line items time out. Workaround: split the invoice or export CSV. Engineering fix in progress.",
  },
  {
    id: "KB-302",
    title: "Recurring invoices did not send",
    keywords: ["recurring", "schedule", "did not send", "not sent", "automatic", "missed"],
    body: "Recurring invoices send at 09:00 in the workspace time zone. Check the schedule is active and the client has a valid email.",
  },
  {
    id: "KB-303",
    title: "Service status and outages",
    keywords: ["outage", "down", "500", "error", "unavailable", "status page", "slow"],
    body: "Check status.ledgerly.example for live incidents. Workspace-wide errors affecting several users should be escalated to on-call.",
  },
  {
    id: "KB-401",
    title: "Exporting or deleting your data (GDPR/CCPA)",
    keywords: ["gdpr", "ccpa", "delete my data", "export my data", "data request", "erase", "privacy"],
    body: "Data subject requests are handled by the privacy team within 30 days. Support must log the request and escalate; do not delete data directly.",
  },
  {
    id: "KB-402",
    title: "Reporting a security concern",
    keywords: ["security", "vulnerability", "phishing", "suspicious", "unauthorized", "breach", "hacked"],
    body: "Suspected unauthorized access or vulnerabilities go to the security team immediately. Advise the user to rotate their password and review active sessions.",
  },
  {
    id: "KB-501",
    title: "Requesting a feature",
    keywords: ["feature", "request", "would be nice", "suggestion", "roadmap", "integration"],
    body: "Feature requests are logged to the product board. We do not commit to delivery dates in support replies.",
  },
];
