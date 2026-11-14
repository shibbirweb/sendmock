"use client";

import { Safari } from "@/components/ui/safari";
import { basePath } from "@/lib/layout.shared";
import { cn } from "@/lib/utils";

import { SectionHeading } from "./section-heading";
import { useArrowKeyTabs } from "./use-arrow-key-tabs";

/** Captured from the demo app by `bun run screenshots`. */
const productShots = [
  {
    key: "mail",
    label: "Email",
    url: "localhost:8025/mail",
    alt: "The Mail screen: a list of caught emails and one open with its HTML preview, tabs and actions.",
  },
  {
    key: "sms",
    label: "SMS",
    url: "localhost:8025/sms",
    alt: "The SMS screen: a WhatsApp conversation with media, delivery details and the reply webhook result.",
  },
  {
    key: "webhooks",
    label: "Webhooks",
    url: "localhost:8025/webhooks/overview",
    alt: "The Webhooks overview: deliveries over time, success rate, latency and failures per endpoint.",
  },
  {
    key: "checkout",
    label: "Payments",
    url: "localhost:8025/pay",
    alt: "A test checkout page for SSLCommerz with cards, mobile banking and net banking, and test controls.",
  },
];

export function ScreenshotsSection() {
  const { selectedIndex, setSelectedIndex, moveSelection, tabId, panelId } =
    useArrowKeyTabs(productShots.length);
  const selectedShot = productShots[selectedIndex] ?? productShots[0];

  return (
    <section
      aria-labelledby="screenshots-heading"
      className="mx-auto flex w-full max-w-5xl flex-col items-center gap-6 px-4 py-20"
    >
      <SectionHeading
        headingId="screenshots-heading"
        eyebrow="Screenshots"
        title="See what your app sent"
        description="Every message, delivery and payment in one web UI, live as it happens."
        className="mb-4"
      />
      <div
        role="tablist"
        aria-label="Product screens"
        onKeyDown={moveSelection}
        className="flex flex-wrap justify-center gap-1 rounded-full border bg-fd-card p-1"
      >
        {productShots.map((productShot, shotIndex) => (
          <button
            key={productShot.key}
            id={tabId(shotIndex)}
            type="button"
            role="tab"
            aria-selected={shotIndex === selectedIndex}
            aria-controls={panelId}
            tabIndex={shotIndex === selectedIndex ? 0 : -1}
            onClick={() => setSelectedIndex(shotIndex)}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
              shotIndex === selectedIndex
                ? "bg-fd-primary text-fd-primary-foreground"
                : "text-fd-muted-foreground hover:text-fd-foreground",
            )}
          >
            {productShot.label}
          </button>
        ))}
      </div>
      <div
        id={panelId}
        role="tabpanel"
        aria-labelledby={tabId(selectedIndex)}
        className="w-full"
      >
        <Safari
          key={selectedShot.key}
          url={selectedShot.url}
          imageSrc={`${basePath}/screenshots/${selectedShot.key}-light.jpg`}
          darkImageSrc={`${basePath}/screenshots/${selectedShot.key}-dark.jpg`}
          imageAlt={selectedShot.alt}
          className="drop-shadow-xl"
        />
      </div>
    </section>
  );
}
