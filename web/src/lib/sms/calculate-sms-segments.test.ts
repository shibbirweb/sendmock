import { describe, expect, test } from "vitest";

import { calculateSmsSegments } from "@/lib/sms/calculate-sms-segments";

describe("calculateSmsSegments", () => {
  test("SM-06.1 160 GSM-7 characters fit in one segment", () => {
    const segmentInfo = calculateSmsSegments("a".repeat(160));

    expect(segmentInfo.encoding).toBe("GSM-7");
    expect(segmentInfo.segmentCount).toBe(1);
  });

  test("SM-06.1 161 GSM-7 characters need two segments of 153", () => {
    const segmentInfo = calculateSmsSegments("a".repeat(161));

    expect(segmentInfo.segmentCount).toBe(2);
    expect(segmentInfo.unitsPerSegment).toBe(153);
  });

  test("SM-06.1 extension characters count as two septets", () => {
    const segmentInfo = calculateSmsSegments("€".repeat(80));

    expect(segmentInfo.encoding).toBe("GSM-7");
    expect(segmentInfo.unitCount).toBe(160);
    expect(segmentInfo.segmentCount).toBe(1);
  });

  test("SM-06.2 a non-GSM character switches the message to UCS-2", () => {
    const segmentInfo = calculateSmsSegments("Your code is 4821 ✅");

    expect(segmentInfo.encoding).toBe("UCS-2");
  });

  test("SM-06.2 70 UCS-2 characters fit in one segment, 71 need two", () => {
    expect(calculateSmsSegments("আ".repeat(70)).segmentCount).toBe(1);

    const twoSegmentInfo = calculateSmsSegments("আ".repeat(71));
    expect(twoSegmentInfo.segmentCount).toBe(2);
    expect(twoSegmentInfo.unitsPerSegment).toBe(67);
  });

  test("an empty message still counts as one segment", () => {
    expect(calculateSmsSegments("").segmentCount).toBe(1);
  });
});
