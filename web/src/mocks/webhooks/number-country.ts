/** Calling codes the mock names a country for, longest first, as the server does. */
const countryCallingCodes: [string, string][] = [
  ["+880", "BD"],
  ["+234", "NG"],
  ["+254", "KE"],
  ["+971", "AE"],
  ["+44", "GB"],
  ["+49", "DE"],
  ["+33", "FR"],
  ["+34", "ES"],
  ["+61", "AU"],
  ["+91", "IN"],
  ["+55", "BR"],
  ["+1", "US"],
];

/** The ISO country of an E.164 number from its calling code; empty when unknown (SM-22.2). */
export function findNumberCountry(e164Number: string): string {
  return (
    countryCallingCodes.find(([callingCode]) =>
      e164Number.startsWith(callingCode),
    )?.[1] ?? ""
  );
}
