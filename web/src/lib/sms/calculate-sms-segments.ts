import type { SmsEncoding } from "@/lib/api/types";

/** GSM 03.38 basic character set (one septet each). */
const gsmBasicCharacters = new Set(
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà",
);

/** GSM 03.38 extension table characters (two septets each: escape + char). */
const gsmExtensionCharacters = new Set("^{}\\[~]|€\f");

const singleSegmentLimit: Record<SmsEncoding, number> = {
  "GSM-7": 160,
  "UCS-2": 70,
};

const concatenatedSegmentLimit: Record<SmsEncoding, number> = {
  "GSM-7": 153,
  "UCS-2": 67,
};

export type SmsSegmentInfo = {
  encoding: SmsEncoding;
  /** Septets for GSM-7, UTF-16 code units for UCS-2. */
  unitCount: number;
  segmentCount: number;
  unitsPerSegment: number;
  remainingUnitsInSegment: number;
};

function countGsmSeptets(messageText: string): number | null {
  let septetCount = 0;

  for (const character of messageText) {
    if (gsmBasicCharacters.has(character)) {
      septetCount += 1;
    } else if (gsmExtensionCharacters.has(character)) {
      septetCount += 2;
    } else {
      return null;
    }
  }

  return septetCount;
}

/**
 * Works out the encoding and segment count the way carriers do (SM-06):
 * GSM-7 when every character fits, otherwise UCS-2.
 */
export function calculateSmsSegments(messageText: string): SmsSegmentInfo {
  const gsmSeptetCount = countGsmSeptets(messageText);
  const encoding: SmsEncoding = gsmSeptetCount === null ? "UCS-2" : "GSM-7";
  const unitCount = gsmSeptetCount ?? messageText.length;

  const isSingleSegment = unitCount <= singleSegmentLimit[encoding];
  const unitsPerSegment = isSingleSegment
    ? singleSegmentLimit[encoding]
    : concatenatedSegmentLimit[encoding];
  const segmentCount = Math.max(1, Math.ceil(unitCount / unitsPerSegment));

  return {
    encoding,
    unitCount,
    segmentCount,
    unitsPerSegment,
    remainingUnitsInSegment: segmentCount * unitsPerSegment - unitCount,
  };
}
