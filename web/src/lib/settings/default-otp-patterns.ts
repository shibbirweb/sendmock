/** Patterns SendMock starts with; "Restore defaults" brings them back. */
export const defaultOtpPatterns = [
  "(?:code|otp|verification|passcode)[^0-9]{0,40}(\\d{4,8})",
  "\\b(\\d{6})\\b",
];
