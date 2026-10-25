export type OtpMatch = {
  patternIndex: number;
  code: string;
};

/** Compiles a pattern case-insensitively, or returns null when it is invalid. */
export function compileOtpPattern(otpPattern: string): RegExp | null {
  try {
    return new RegExp(otpPattern, "i");
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
