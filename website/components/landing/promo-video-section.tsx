import { InboxIcon, SlidersHorizontalIcon, TimerIcon } from "lucide-react";

import { Safari } from "@/components/ui/safari";
import { basePath } from "@/lib/layout.shared";

import { PromoVideoPlayer } from "./promo-video-player";
import { SectionHeading } from "./section-heading";

/**
 * The promotional trailer on YouTube, https://youtu.be/OHR7pVFGTl4
 * (docs/plan/23-promotional-video.md, YouTube upload).
 */
const promoVideoYoutubeId = "OHR7pVFGTl4";

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

/** WS-02.4: the promotional video, with its poster, its player and the three benefits it sells. */
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
      <PromoVideoPlayer
        youtubeVideoId={promoVideoYoutubeId}
        videoTitle="SendMock: Test Email, SMS & Payment Webhooks on Localhost"
      >
        <Safari
          url="localhost:8025/webhooks/overview"
          imageSrc={`${basePath}/screenshots/webhooks-light.jpg`}
          darkImageSrc={`${basePath}/screenshots/webhooks-dark.jpg`}
          className="size-full"
        />
      </PromoVideoPlayer>
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
