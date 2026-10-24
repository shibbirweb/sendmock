import type {
  EmailDetail,
  HtmlCheckReport,
  LinkCheckResult,
  ListUnsubscribeReport,
  SpamCheckReport,
} from "@/lib/api/types";

/** Believable check results for demo data (the real checks arrive in Phase 4). */

const emailClients = [
  "Apple Mail",
  "Gmail",
  "Outlook (Windows)",
  "Outlook.com",
  "Yahoo Mail",
  "Samsung Email",
];

const cssFeatureRules = [
  { pattern: /background/i, feature: "CSS background", outlookPercent: 40 },
  { pattern: /<table/i, feature: "HTML tables", outlookPercent: 100 },
  { pattern: /cid:/i, feature: "Inline CID images", outlookPercent: 90 },
  { pattern: /<img/i, feature: "Remote images", outlookPercent: 70 },
];

function findLineNumber(htmlBody: string, pattern: RegExp): number | null {
  const lineIndex = htmlBody
    .split("\n")
    .findIndex((line) => pattern.test(line));

  return lineIndex === -1 ? null : lineIndex + 1;
}

export function buildHtmlCheckReport(email: EmailDetail): HtmlCheckReport {
  const htmlBody = email.html_body ?? "";
  const matchedRules = cssFeatureRules.filter((rule) =>
    rule.pattern.test(htmlBody),
  );
  const lowestOutlookPercent = Math.min(
    100,
    ...matchedRules.map((rule) => rule.outlookPercent),
  );

  return {
    overall_support_percent: htmlBody
      ? Math.round((500 + lowestOutlookPercent) / 6)
      : 100,
    clients: emailClients.map((clientName) => ({
      client: clientName,
      support_percent: clientName.startsWith("Outlook")
        ? lowestOutlookPercent
        : 100,
    })),
    warnings: matchedRules
      .filter((rule) => rule.outlookPercent < 100)
      .map((rule) => ({
        feature: rule.feature,
        support_percent: rule.outlookPercent,
        line: findLineNumber(htmlBody, rule.pattern),
        note: `Partly supported in Outlook for Windows (${rule.outlookPercent}%).`,
      })),
  };
}

export function buildLinkCheckResults(email: EmailDetail): LinkCheckResult[] {
  const imageUrls = [
    ...(email.html_body ?? "").matchAll(/<img[^>]+src="([^"]+)"/gi),
  ]
    .map((imageMatch) => imageMatch[1] ?? "")
    .filter((imageUrl) => imageUrl.startsWith("http"));

  return [
    ...email.extracted.links.map((linkUrl, linkIndex) => ({
      url: linkUrl,
      kind: "link" as const,
      status_code: linkIndex % 3 === 2 ? 301 : 200,
      redirect_url: linkIndex % 3 === 2 ? `${linkUrl}/` : null,
      duration_ms: 80 + linkIndex * 35,
      error_message: null,
    })),
    ...imageUrls.map((imageUrl) => ({
      url: imageUrl,
      kind: "image" as const,
      status_code: imageUrl.includes("tracking") ? 404 : 200,
      redirect_url: null,
      duration_ms: 120,
      error_message: imageUrl.includes("tracking") ? "Not Found" : null,
    })),
  ];
}

export function buildSpamCheckReport(email: EmailDetail): SpamCheckReport {
  const isPromotional = /(last chance|% off|free|win)/i.test(email.subject);

  return {
    is_available: true,
    score: isPromotional ? 4.1 : 0.8,
    threshold: 5,
    rules: isPromotional
      ? [
          {
            name: "SUBJ_ALL_CAPS_PERCENT",
            score: 1.2,
            description: "Subject talks about a discount",
          },
          {
            name: "HTML_IMAGE_ONLY_08",
            score: 1.6,
            description: "HTML: images with 0-800 bytes of words",
          },
          {
            name: "MISSING_MID",
            score: 0.5,
            description: "Missing Message-ID header",
          },
          {
            name: "URIBL_GREY",
            score: 0.8,
            description: "Contains a URL listed in the URIBL greylist",
          },
        ]
      : [
          {
            name: "HTML_MESSAGE",
            score: 0.8,
            description: "HTML included in message",
          },
        ],
  };
}

export function buildListUnsubscribeReport(
  email: EmailDetail,
): ListUnsubscribeReport {
  const senderAddress = email.from.address;
  const isBulkSender = /^(news|promo)@/i.test(senderAddress);

  if (!isBulkSender) {
    return {
      has_header: false,
      values: [],
      supports_one_click: false,
      warnings: [],
    };
  }

  const isPromotional = senderAddress.startsWith("promo@");

  return {
    has_header: true,
    values: [
      "<https://acme.test/unsubscribe?u=42>",
      "<mailto:unsubscribe@acme.test>",
    ],
    supports_one_click: !isPromotional,
    warnings: isPromotional
      ? [
          "List-Unsubscribe-Post is missing, so one-click unsubscribe (RFC 8058) is not supported.",
        ]
      : [],
  };
}
