import {
  InboxIcon,
  PlayIcon,
  SlidersHorizontalIcon,
  TimerIcon,
} from "lucide-react";

import { Safari } from "@/components/ui/safari";
import { basePath } from "@/lib/layout.shared";
import { cn } from "@/lib/utils";

import { SectionHeading } from "./section-heading";

/**
 * The published promotional video on YouTube, or null until it is produced
 * (docs/plan/16-website-and-releases.md, Promotional video).
 */
const promoVideoUrl: string | null = null;

/** The video's message in three points: the problem it removes and the time it saves. */
const benefitPoints = [
  {
    icon: InboxIcon,
    title: "No real messages sent",
    description:
      "Nothing reaches a real inbox, phone or card while you test. Every email, SMS, payment and webhook stays on your machine.",
  },
  {
    icon: TimerIcon,
    title: "Seconds, not minutes",
    description:
      "Read the OTP, preview the email or replay the webhook right away, instead of waiting on a phone, an inbox or a provider dashboard.",
  },
  {
    icon: SlidersHorizontalIcon,
    title: "One setting to switch",
    description:
      "Change one host and port. Your app and its provider SDKs keep working, with no code changes.",
  },
];

const playButtonClassName =
  "flex size-20 items-center justify-center rounded-full bg-linear-to-br from-(--brand-from) to-(--brand-to) text-white shadow-xl ring-8 ring-fd-background/60";

function PlayVideoButton() {
  if (promoVideoUrl === null) {
    return (
      <div className="flex flex-col items-center gap-3">
        <button
          type="button"
          disabled
          aria-label="Play the video (coming soon)"
          className={cn(playButtonClassName, "opacity-90")}
        >
          <PlayIcon aria-hidden className="ms-1 size-8 fill-current" />
        </button>
        <span className="rounded-full border bg-fd-background/90 px-3 py-1 text-xs font-medium shadow-sm">
          Video coming soon
        </span>
      </div>
    );
  }

  return (
    <a
      href={promoVideoUrl}
      target="_blank"
      rel="noreferrer"
      aria-label="Play the video"
      className={cn(
        playButtonClassName,
        "transition-transform hover:scale-105",
      )}
    >
      <PlayIcon aria-hidden className="ms-1 size-8 fill-current" />
    </a>
  );
}

/** WS-02.4: the promotional video, with its poster and the three benefits it sells. */
export function PromoVideoSection() {
  return (
    <section
      aria-labelledby="promo-video-heading"
      className="mx-auto flex w-full max-w-5xl flex-col items-center gap-10 px-4 py-20"
    >
      <SectionHeading
        headingId="promo-video-heading"
        eyebrow="Why SendMock"
        title="Stop testing on real inboxes and phones"
        description="See in a short video why testing what your app sends is slow and risky, and how SendMock makes it safe and fast."
      />
      <div
        data-testid="promo-video-poster"
        className="relative w-full overflow-hidden rounded-xl"
      >
        <Safari
          url="localhost:8025/webhooks/overview"
          imageSrc={`${basePath}/screenshots/webhooks-light.jpg`}
          darkImageSrc={`${basePath}/screenshots/webhooks-dark.jpg`}
          className="size-full"
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-linear-to-t from-fd-background/80 via-fd-background/40 to-fd-background/20"
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <PlayVideoButton />
        </div>
      </div>
      <ul
        aria-label="Why developers use SendMock"
        className="grid w-full gap-4 sm:grid-cols-3"
      >
        {benefitPoints.map((benefitPoint) => (
          <li
            key={benefitPoint.title}
            className="flex flex-col gap-2 rounded-xl border bg-fd-card p-5"
          >
            <benefitPoint.icon
              aria-hidden
              className="size-5 text-(--brand-text)"
            />
            <h3 className="font-semibold">{benefitPoint.title}</h3>
            <p className="text-sm text-fd-muted-foreground">
              {benefitPoint.description}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
