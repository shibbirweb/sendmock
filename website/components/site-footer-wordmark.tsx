"use client";

import { useId, useRef } from "react";

/** The wordmark's drawing area; the word rests on its bottom edge, the bottom of the page. */
const viewBoxWidth = 1000;
const viewBoxHeight = 157;
const wordmarkFontSize = 196;
/** Round letters such as S, e and o dip just below the baseline, so it sits 3 units above the edge. */
const baselineY = viewBoxHeight - 3;
/** Where the spotlight starts; after that it stays where the pointer last was. */
const startingSpotlight = { x: viewBoxWidth / 2, y: viewBoxHeight * 0.55 };

/** Small and dense, so the lines read as the letters' texture and the word stays legible. */
const feedFontSize = 6.5;
const feedRowHeight = 7.5;
const feedRowCount = Math.ceil(viewBoxHeight / feedRowHeight);
/** Each row repeats its events until it is at least this wide, so it spans the whole word. */
const feedRowMinimumCharacters = 420;

/** What SendMock catches, as the event lines that fill the letters. */
const caughtEvents = [
  "email.received  welcome@acme.test  Confirm your address",
  "sms.delivered  +15550001111  Your code is 482913",
  "POST /hooks/stripe  200 OK  38 ms",
  "payment.succeeded  $49.00  pi_3QXa9",
  "push.sent  fcm  New message from Ana",
  "verify.approved  VA0001  123456",
  "email.bounced  nobody@example.test  550 5.1.1",
  "sms.inbound  +15550002222  STOP",
  "webhook.retry  attempt 2  503",
  "email.opened  invoice-2291  Mail.app",
];

/** Row `rowIndex`: the events from a different starting point, so the rows do not line up. */
function buildFeedRow(rowIndex: number): string {
  const startIndex = rowIndex % caughtEvents.length;
  const rotatedEvents = [
    ...caughtEvents.slice(startIndex),
    ...caughtEvents.slice(0, startIndex),
  ];
  let rowText = "";
  while (rowText.length < feedRowMinimumCharacters) {
    rowText += `${rotatedEvents.join("   ·   ")}   ·   `;
  }
  return rowText;
}

const feedRows = Array.from({ length: feedRowCount }, (_, rowIndex) => ({
  rowText: buildFeedRow(rowIndex),
  baselineY: feedRowHeight * (rowIndex + 1) - 1.5,
}));

/** `useId` gives `«r1»`-style ids, which `url(#...)` references cannot hold. */
function toSvgId(reactId: string, partName: string): string {
  return `wordmark-${reactId.replace(/[^a-zA-Z0-9]/g, "")}-${partName}`;
}

/**
 * The event lines; the same rows serve the quiet layer and the lit one. They stay still:
 * scrolling them repainted every row through the clip and the mask on each frame, which made
 * the page lag on phones and laptops.
 */
function FeedRows({ fill }: { fill: string }) {
  return feedRows.map((feedRow) => (
    <text
      key={feedRow.baselineY}
      y={feedRow.baselineY}
      fill={fill}
      data-wordmark-feed-row=""
      className="font-mono"
      style={{ fontSize: feedFontSize }}
    >
      {feedRow.rowText}
    </text>
  ));
}

/**
 * The large SendMock wordmark at the foot of every page, its letters filled with the traffic
 * SendMock catches: rows of email, SMS, webhook and payment events fill them, and the rows
 * under the pointer light up in the brand gradient. Decorative, so hidden from
 * assistive technology; the footer above already names SendMock.
 */
export function SiteFooterWordmark() {
  const reactId = useId();
  const spotlightRef = useRef<SVGRadialGradientElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const clipId = toSvgId(reactId, "letters");
  const brandId = toSvgId(reactId, "brand");
  const spotlightId = toSvgId(reactId, "spotlight");
  const maskId = toSvgId(reactId, "mask");

  function moveSpotlight(spotlightX: number, spotlightY: number) {
    spotlightRef.current?.setAttribute("cx", String(spotlightX));
    spotlightRef.current?.setAttribute("cy", String(spotlightY));
  }

  // Updating the gradient's attributes directly keeps pointer movement off React's render path.
  function followPointer(pointerEvent: React.PointerEvent<SVGSVGElement>) {
    const screenToSvg = svgRef.current?.getScreenCTM()?.inverse();
    if (!screenToSvg) {
      return;
    }
    const pointerInSvg = new DOMPoint(
      pointerEvent.clientX,
      pointerEvent.clientY,
    ).matrixTransform(screenToSvg);
    moveSpotlight(pointerInSvg.x, pointerInSvg.y);
  }

  return (
    <div className="overflow-hidden">
      <div className="mx-auto w-full max-w-5xl px-4 pt-2">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
          className="block h-auto w-full select-none text-fd-foreground"
          aria-hidden
          focusable="false"
          onPointerMove={followPointer}
        >
          <defs>
            {/* System fonts differ in width, so the word is fitted by scaling its glyphs. */}
            <clipPath id={clipId}>
              <text
                x={viewBoxWidth / 2}
                y={baselineY}
                textAnchor="middle"
                textLength={viewBoxWidth - 10}
                lengthAdjust="spacingAndGlyphs"
                className="font-sans font-black"
                style={{ fontSize: wordmarkFontSize }}
              >
                SendMock
              </text>
            </clipPath>
            <linearGradient id={brandId} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" style={{ stopColor: "var(--brand-from)" }} />
              <stop offset="100%" style={{ stopColor: "var(--brand-to)" }} />
            </linearGradient>
            <radialGradient
              ref={spotlightRef}
              id={spotlightId}
              gradientUnits="userSpaceOnUse"
              cx={startingSpotlight.x}
              cy={startingSpotlight.y}
              r="190"
            >
              <stop offset="0%" stopColor="white" />
              <stop offset="100%" stopColor="white" stopOpacity="0" />
            </radialGradient>
            <mask id={maskId}>
              <rect
                width={viewBoxWidth}
                height={viewBoxHeight}
                fill={`url(#${spotlightId})`}
              />
            </mask>
          </defs>
          <g clipPath={`url(#${clipId})`}>
            <rect
              width={viewBoxWidth}
              height={viewBoxHeight}
              fill="currentColor"
              fillOpacity="0.1"
            />
            <g fillOpacity="0.45">
              <FeedRows fill="currentColor" />
            </g>
            <g mask={`url(#${maskId})`}>
              <rect
                width={viewBoxWidth}
                height={viewBoxHeight}
                fill={`url(#${brandId})`}
                fillOpacity="0.12"
              />
              <FeedRows fill={`url(#${brandId})`} />
            </g>
          </g>
        </svg>
      </div>
    </div>
  );
}
