const sparklineWidth = 96;
const sparklineHeight = 24;
const strokeInset = 2;

/** Line segments that skip hours without deliveries. */
function buildSegments(successHistory: (number | null)[]): string[] {
  const stepWidth = sparklineWidth / Math.max(1, successHistory.length - 1);
  const plotHeight = sparklineHeight - strokeInset * 2;
  const segments: string[] = [];
  let currentSegment: string[] = [];

  successHistory.forEach((successRate, hourIndex) => {
    if (successRate === null) {
      if (currentSegment.length > 0) {
        segments.push(currentSegment.join(" "));
      }
      currentSegment = [];
      return;
    }

    const pointX = (hourIndex * stepWidth).toFixed(1);
    const pointY = (strokeInset + (1 - successRate) * plotHeight).toFixed(1);
    currentSegment.push(`${pointX},${pointY}`);
  });
  if (currentSegment.length > 0) {
    segments.push(currentSegment.join(" "));
  }

  return segments;
}

/**
 * 24 hourly success rates as a line; the rate itself is printed beside it,
 * so the line only shows the trend (WH-01.7).
 */
export function SuccessSparkline({
  successHistory,
}: {
  successHistory: (number | null)[];
}) {
  const segments = buildSegments(successHistory);

  return (
    <svg
      data-testid="success-sparkline"
      width={sparklineWidth}
      height={sparklineHeight}
      viewBox={`0 0 ${sparklineWidth} ${sparklineHeight}`}
      aria-hidden="true"
      className="shrink-0 overflow-visible"
    >
      <line
        x1={0}
        x2={sparklineWidth}
        y1={sparklineHeight - strokeInset}
        y2={sparklineHeight - strokeInset}
        className="stroke-border"
        strokeWidth={1}
      />
      {segments.map((segmentPoints) =>
        segmentPoints.includes(" ") ? (
          <polyline
            key={segmentPoints}
            points={segmentPoints}
            fill="none"
            className="stroke-chart-1"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : (
          <circle
            key={segmentPoints}
            cx={segmentPoints.split(",")[0]}
            cy={segmentPoints.split(",")[1]}
            r={2}
            className="fill-chart-1"
          />
        ),
      )}
    </svg>
  );
}
