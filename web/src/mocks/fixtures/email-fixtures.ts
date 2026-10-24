import {
  buildEmailFixture,
  type EmailFixture,
  type EmailFixtureSpec,
  generateRandomEmailSpecs,
} from "@/mocks/fixtures/email-fixture-builder";

const appSender = { name: "Acme App", address: "no-reply@acme.test" };
const customer = { name: "Rahim Uddin", address: "rahim@example.com" };

/** Hand-written cases that cover the edge cases listed in the roadmap. */
const handcraftedEmailSpecs: EmailFixtureSpec[] = [
  {
    minutesAgo: 1,
    from: appSender,
    to: [customer],
    subject: "Your verification code",
    htmlBody:
      "<h2>Verify your account</h2><p>Your verification code is <strong>482913</strong>. It expires in 10 minutes.</p>",
    tags: ["auth"],
  },
  {
    minutesAgo: 6,
    from: appSender,
    to: [customer],
    subject: "Reset your password",
    htmlBody:
      '<p>Hi Rahim,</p><p>Click the link below to reset your password.</p><p><a href="https://acme.test/reset?token=9f8e7d6c">Reset password</a></p><img src="https://tracking.acme.test/open.gif" width="1" height="1">',
    openCount: 2,
    isRead: true,
  },
  {
    minutesAgo: 14,
    from: { name: "Acme Newsletter", address: "news@acme.test" },
    to: [customer],
    subject: "Welcome to Acme: here is what is new this week",
    htmlBody:
      '<table width="100%" style="background:#f4f4f5;padding:24px"><tr><td><h1 style="color:#18181b">Welcome aboard</h1><p>Three new features shipped this week.</p><img src="cid:hero-image" alt="Hero"><p><a href="https://acme.test/blog">Read the blog</a></p></td></tr></table>',
    attachments: [
      {
        filename: "hero.png",
        content_type: "image/png",
        size_bytes: 48_213,
        content_id: "hero-image",
        is_inline: true,
      },
    ],
    source: "sendgrid",
    template: {
      template_id: "d-4f1c2b9a7e6d",
      template_data: { first_name: "Rahim", plan: "Pro" },
    },
  },
  {
    minutesAgo: 22,
    from: { name: "Acme Billing", address: "billing@acme.test" },
    to: [customer],
    subject: "Invoice INV-2026-0042",
    textBody:
      "Please find your invoice for October attached. Amount due: $49.00.",
    attachments: [
      {
        filename: "INV-2026-0042.pdf",
        content_type: "application/pdf",
        size_bytes: 182_440,
        content_id: null,
        is_inline: false,
      },
    ],
    tags: ["billing"],
    source: "postmark",
    deliveryStatus: "delivered",
  },
  {
    minutesAgo: 31,
    from: appSender,
    to: [{ name: "", address: "unknown-user@example.com" }],
    subject: "Your weekly report is ready",
    textBody: "Your weekly report is ready to download.",
    deliveryStatus: "bounced",
    source: "resend",
  },
  {
    minutesAgo: 38,
    from: { name: "Acme Promotions", address: "promo@acme.test" },
    to: [customer],
    subject: "Last chance: 30% off annual plans",
    htmlBody: "<p>Upgrade today and save 30%.</p>",
    deliveryStatus: "complained",
    source: "mailgun",
  },
  {
    minutesAgo: 45,
    from: { name: "Cron", address: "cron@server.test" },
    to: [{ name: "Ops", address: "ops@acme.test" }],
    subject: "Nightly backup finished",
    textBody: "Backup completed in 4m 12s. 1,204 files, 3.2 GB.",
    source: "sendmail",
    isRead: true,
  },
  {
    minutesAgo: 52,
    from: appSender,
    to: [{ name: "রহিম উদ্দিন", address: "rahim.bn@example.com" }],
    subject: "আপনার অর্ডার নিশ্চিত হয়েছে",
    textBody:
      "ধন্যবাদ! আপনার অর্ডার #10293 নিশ্চিত হয়েছে এবং শীঘ্রই পাঠানো হবে।",
  },
  {
    minutesAgo: 57,
    from: appSender,
    to: [{ name: "سارة", address: "sara@example.com" }],
    subject: "تم تأكيد حجزك",
    textBody: "شكرا لك! تم تأكيد حجزك ليوم الخميس.",
  },
  {
    minutesAgo: 63,
    from: appSender,
    to: [{ name: "Yuki", address: "yuki@example.com" }],
    subject: "ご注文ありがとうございます",
    textBody: "ご注文を承りました。発送までしばらくお待ちください。",
  },
  {
    minutesAgo: 70,
    from: appSender,
    to: [customer],
    subject:
      "This is an intentionally very long subject line that keeps going to make sure the list truncates it nicely without breaking the layout of the row",
    textBody: "Long subject test.",
  },
  {
    minutesAgo: 76,
    from: { name: "Legacy System", address: "legacy@old.test" },
    to: [customer],
    subject: "Broken HTML sample",
    htmlBody: "<div><p>Unclosed tags <b>bold <i>italic<table><tr><td>cell",
  },
];

/** The standard demo mailbox: hand-written cases first, then random filler. */
export function buildStandardEmailFixtures(): EmailFixture[] {
  return [...handcraftedEmailSpecs, ...generateRandomEmailSpecs(18)].map(
    buildEmailFixture,
  );
}

/** A large mailbox for performance and pagination testing. */
export function buildLargeEmailFixtures(emailCount: number): EmailFixture[] {
  return [
    ...handcraftedEmailSpecs,
    ...generateRandomEmailSpecs(emailCount),
  ].map(buildEmailFixture);
}
