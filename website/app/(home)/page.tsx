import { FeaturesSection } from "@/components/landing/features-section";
import { FlowSection } from "@/components/landing/flow-section";
import { HeroSection } from "@/components/landing/hero-section";
import { NumbersSection } from "@/components/landing/numbers-section";
import { PromoVideoSection } from "@/components/landing/promo-video-section";
import { QuickStartSection } from "@/components/landing/quick-start-section";
import { ScreenshotsSection } from "@/components/landing/screenshots-section";
import { WorksWithSection } from "@/components/landing/works-with-section";
import { readInstallPrompt } from "@/lib/install-with-ai/read-install-prompt";

/** The landing page (WS-02): Magic UI sections, all static with reduced motion. */
export default function HomePage() {
  return (
    <main className="flex flex-col">
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
