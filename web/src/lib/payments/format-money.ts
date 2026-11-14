/** Decimal places of a currency's minor unit: 2 for USD and BDT, 0 for JPY. */
export function readMinorUnitDigits(currency: string): number {
  try {
    return (
      new Intl.NumberFormat("en", {
        style: "currency",
        currency,
      }).resolvedOptions().maximumFractionDigits ?? 2
    );
  } catch {
    return 2;
  }
}

/** A stored minor-unit amount in the currency's own format, e.g. "$49.00", "¥3,000" (PY-02.3). */
export function formatMinorAmount(
  amountMinor: number,
  currency: string,
  locale?: string,
): string {
  const minorDigits = readMinorUnitDigits(currency);
  const majorAmount = amountMinor / 10 ** minorDigits;
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
    }).format(majorAmount);
  } catch {
    return `${majorAmount.toFixed(minorDigits)} ${currency}`;
  }
}

/** A typed amount like "12.50" in minor units, or null when it is not a valid amount. */
export function parseMajorAmount(
  amountText: string,
  currency: string,
): number | null {
  const minorDigits = readMinorUnitDigits(currency);
  const amountPattern =
    minorDigits === 0
      ? /^\d+$/
      : new RegExp(`^\\d+(\\.\\d{1,${minorDigits}})?$`);
  const trimmedText = amountText.trim();
  if (!amountPattern.test(trimmedText)) {
    return null;
  }

  return Math.round(Number(trimmedText) * 10 ** minorDigits);
}
