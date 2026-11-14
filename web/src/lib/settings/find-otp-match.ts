export type OtpMatch = {
  patternIndex: number;
  code: string;
};

/**
 * Leading inline flags such as `(?i)`: the server's patterns are Rust regexes, which allow
 * them, and JavaScript only takes them as RegExp flags.
 */
const leadingInlineFlags = /^\(\?([ims]+)\)/;

/** Compiles a pattern case-insensitively, or returns null when it is invalid. */
export function compileOtpPattern(otpPattern: string): RegExp | null {
  const inlineFlags = leadingInlineFlags.exec(otpPattern)?.[1] ?? "";
  const patternBody =
    inlineFlags === "" ? otpPattern : otpPattern.slice(inlineFlags.length + 3);
  const regexFlags = [...new Set(["i", ...inlineFlags])].join("");
  try {
    return new RegExp(patternBody, regexFlags);
  } catch {
    return null;
  }
}

/**
 * The first pattern that matches and the code from its first capture group,
 * as the extractor does for new messages (EM-05.5).
 */
export function findOtpMatch(
  otpPatterns: string[],
  messageText: string,
): OtpMatch | null {
  for (const [patternIndex, otpPattern] of otpPatterns.entries()) {
    const capturedCode = compileOtpPattern(otpPattern)?.exec(messageText)?.[1];
    if (capturedCode !== undefined) {
      return { patternIndex, code: capturedCode };
    }
  }

  return null;
}
