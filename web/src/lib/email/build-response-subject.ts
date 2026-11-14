import type { EmailResponseKind } from "@/lib/api/types";

const subjectPrefixes: Record<EmailResponseKind, string> = {
  reply: "Re:",
  forward: "Fwd:",
};

const existingPrefixPatterns: Record<EmailResponseKind, RegExp> = {
  reply: /^\s*re:/i,
  forward: /^\s*(fwd?|fw):/i,
};

/** "Re: Invoice" for a reply, "Fwd: Invoice" for a forward, never doubled. */
export function buildResponseSubject(
  originalSubject: string,
  responseKind: EmailResponseKind,
): string {
  if (existingPrefixPatterns[responseKind].test(originalSubject)) {
    return originalSubject;
  }

  return `${subjectPrefixes[responseKind]} ${originalSubject}`.trim();
}
