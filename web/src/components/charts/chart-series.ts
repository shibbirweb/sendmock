/** One stacked series: its label, swatch token and how to read its value. */
export type ChartSeries<Bucket> = {
  seriesKey: string;
  label: string;
  /** A design token class, e.g. `bg-chart-1` or `bg-success`. */
  swatchClassName: string;
  readValue: (bucket: Bucket) => number;
};

/** How the chart names and labels its buckets. */
export type ChartBucketFormat<Bucket> = {
  readBucketKey: (bucket: Bucket) => string;
  /** The axis label under a column, e.g. "14:00" or "Mon". */
  formatTick: (bucket: Bucket) => string;
  /** The tooltip and table heading, e.g. "14:00 to 15:00". */
  formatRange: (bucket: Bucket) => string;
  /** Label every Nth column. */
  tickInterval: number;
  /** Extra tooltip and table rows after the total, e.g. latency. */
  readExtraRows?: (bucket: Bucket) => { label: string; value: string }[];
};

export function sumBucket<Bucket>(
  chartSeries: ChartSeries<Bucket>[],
  bucket: Bucket,
): number {
  return chartSeries.reduce(
    (totalValue, series) => totalValue + series.readValue(bucket),
    0,
  );
}

/** A round axis maximum (1, 2, 5, 10, 20, 50 ...) at or above the tallest column. */
export function readAxisMaximum(columnTotals: number[]): number {
  const tallestTotal = Math.max(0, ...columnTotals);
  if (tallestTotal <= 4) {
    return 4;
  }

  const magnitude = 10 ** Math.floor(Math.log10(tallestTotal));
  const niceStep = [1, 2, 5, 10].find(
    (stepMultiplier) => stepMultiplier * magnitude >= tallestTotal,
  );

  return (niceStep ?? 10) * magnitude;
}
