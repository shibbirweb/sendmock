import type { Metadata } from "next";

import { FeaturesSection } from "@/components/landing/features-section";
import { FlowSection } from "@/components/landing/flow-section";
import { HeroSection } from "@/components/landing/hero-section";
import { NumbersSection } from "@/components/landing/numbers-section";
import { PromoVideoSection } from "@/components/landing/promo-video-section";
import { QuickStartSection } from "@/components/landing/quick-start-section";
import { ScreenshotsSection } from "@/components/landing/screenshots-section";
import { WorksWithSection } from "@/components/landing/works-with-section";
import { StructuredDataScript } from "@/components/seo/structured-data-script";
import { readInstallPrompt } from "@/lib/install-with-ai/read-install-prompt";
import { buildPageMetadata } from "@/lib/seo/page-metadata";
import { siteUrl } from "@/lib/seo/site-url";
import { buildLandingStructuredData } from "@/lib/seo/structured-data";

const landingDescription =
  "Free, open-source local sandbox: one binary catches email, SMS, payments and webhooks from any app and shows them in a web UI. For Linux, macOS, Windows and Docker.";

export const metadata: Metadata = buildPageMetadata({
  title: "SendMock: local sandbox for email, SMS, payments and webhooks",
  description: landingDescription,
  pagePath: "/",
  socialImage: "landing",
  isAbsoluteTitle: true,
});

/** The landing page (WS-02): Magic UI sections, all static with reduced motion. */
export default function HomePage() {
  return (
    <main className="flex flex-col">
      <StructuredDataScript
        structuredData={buildLandingStructuredData({
          siteUrl,
          description: landingDescription,
        })}
      />
      <HeroSection />
      <FlowSection />
      <WorksWithSection />
      <QuickStartSection installPrompt={readInstallPrompt()} />
      <ScreenshotsSection />
      <FeaturesSection />
      <NumbersSection />
      <PromoVideoSection />
    </main>
  );
}
