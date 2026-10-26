"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * A client component, so every copy gets its own `useId`: the docs render the
 * nav title twice (mobile bar and sidebar), and a shared gradient id would
 * point at the hidden copy and leave the visible logo blank.
 *
 * The SendMock mark: an envelope between code brackets, with a small hook at
 * the flap point for webhooks. Filled with the brand gradient from the
 * `--brand-from` and `--brand-to` theme tokens.
 */
export function SendMockLogo({ className }: { className?: string }) {
  const svgId = React.useId();
  const gradientId = `${svgId}-gradient`;
  const flapMaskId = `${svgId}-flap`;

  return (
    <svg
      viewBox="0 0 64 64"
      aria-hidden="true"
      className={cn("size-8", className)}
    >
      <defs>
        <linearGradient
          id={gradientId}
          x1="0"
          y1="0"
          x2="64"
          y2="64"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" style={{ stopColor: "var(--brand-from)" }} />
          <stop offset="1" style={{ stopColor: "var(--brand-to)" }} />
        </linearGradient>
        <mask id={flapMaskId}>
          <rect width="64" height="64" fill="#fff" />
          <path
            d="M22 25 L32 32.5 L42 25"
            fill="none"
            stroke="#000"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* A small hook at the flap point, where the envelope opens: webhooks. */}
          <path
            d="M32 32.5 V37.5 A3 3 0 0 0 38 37.5 V36.5"
            fill="none"
            stroke="#000"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </mask>
      </defs>
      <g
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth="6.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.6"
      >
        <path d="M15 17 L5 32 L15 47" />
        <path d="M49 17 L59 32 L49 47" />
      </g>
      <rect
        x="18"
        y="19"
        width="28"
        height="26"
        rx="5"
        fill={`url(#${gradientId})`}
        mask={`url(#${flapMaskId})`}
      />
    </svg>
  );
}
