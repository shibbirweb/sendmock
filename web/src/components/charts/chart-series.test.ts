import { describe, expect, test } from "vitest";

import {
  type ChartSeries,
  readAxisMaximum,
  sumBucket,
} from "@/components/charts/chart-series";

type CountBucket = { first: number; second: number };

const countSeries: ChartSeries<CountBucket>[] = [
  {
    seriesKey: "first",
    label: "First",
    swatchClassName: "bg-chart-1",
    readValue: (countBucket) => countBucket.first,
  },
  {
    seriesKey: "second",
    label: "Second",
    swatchClassName: "bg-chart-2",
    readValue: (countBucket) => countBucket.second,
  },
];

describe("chart series", () => {
  test("sums every series of a bucket", () => {
    expect(sumBucket(countSeries, { first: 3, second: 4 })).toBe(7);
  });

  test("rounds the axis up to 1, 2 or 5 times a power of ten", () => {
    expect(readAxisMaximum([0, 3])).toBe(4);
    expect(readAxisMaximum([7])).toBe(10);
    expect(readAxisMaximum([17])).toBe(20);
    expect(readAxisMaximum([61])).toBe(100);
    expect(readAxisMaximum([])).toBe(4);
  });
});
