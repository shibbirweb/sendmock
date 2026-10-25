import type { TemplateReferenceHelper } from "@/lib/api/types";

/** Functions templates can call, documented for the reference panel (WH-07.9). */
export const templateFunctionCatalog: TemplateReferenceHelper[] = [
  {
    name: "now_unix",
    signature: "now_unix()",
    description: "The current time as Unix seconds.",
    example: "1792914927",
  },
  {
    name: "random_string",
    signature: "random_string(length)",
    description: "Random letters and digits, e.g. for a nonce or token.",
    example: "q8F2kD9xLm",
  },
  {
    name: "twilio_signature",
    signature: "twilio_signature(url, fields, auth_token)",
    description:
      "The X-Twilio-Signature for the request, as Twilio computes it.",
    example: "h2Lw0r3mXk9YqP1cVb7Zs4TnJ8e=",
  },
  {
    name: "mailgun_signature",
    signature: "mailgun_signature(signing_key)",
    description: "Mailgun's HMAC signature over timestamp and token.",
    example: "3f1a9c...e07b",
  },
  {
    name: "svix_signature",
    signature: "svix_signature(signing_secret)",
    description: "A Svix signature header, as Resend sends it.",
    example: "v1,K5oZfzN95Z9UVu1EsfQmfVNQ=",
  },
];

/** Filters, applied with `| name`, documented for the reference panel (WH-07.9). */
export const templateFilterCatalog: TemplateReferenceHelper[] = [
  {
    name: "default",
    signature: "default(fallback)",
    description:
      "The fallback when the value is missing or empty; no warning is given.",
    example: '{{ data.subject | default("No subject") }}',
  },
  {
    name: "json",
    signature: "json",
    description: "The value as JSON text, for objects and lists.",
    example: "{{ data.to | json }}",
  },
  {
    name: "urlencode",
    signature: "urlencode",
    description: "Percent-encodes the value for form bodies and query strings.",
    example: "{{ data.body | urlencode }}",
  },
  {
    name: "lower",
    signature: "lower",
    description: "Lowercase.",
    example: "{{ data.from.address | lower }}",
  },
  {
    name: "upper",
    signature: "upper",
    description: "Uppercase.",
    example: "{{ vars.tenant_id | upper }}",
  },
  {
    name: "sendgrid_event",
    signature: "sendgrid_event",
    description:
      "An event type as SendGrid names it: email.bounced becomes bounced.",
    example: "{{ event.type | sendgrid_event }}",
  },
  {
    name: "ses_type",
    signature: "ses_type",
    description:
      "An event type as Amazon SES names it: email.bounced becomes Bounced.",
    example: "{{ event.type | ses_type }}",
  },
  {
    name: "resend_type",
    signature: "resend_type",
    description:
      "An event type as Resend names it: email.bounced stays email.bounced.",
    example: "{{ event.type | resend_type }}",
  },
];
