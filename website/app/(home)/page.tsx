import { CallToActionSection } from "@/components/landing/call-to-action-section";
import { FeaturesSection } from "@/components/landing/features-section";
import { FlowSection } from "@/components/landing/flow-section";
import { HeroSection } from "@/components/landing/hero-section";
import { NumbersSection } from "@/components/landing/numbers-section";
import { QuickStartSection } from "@/components/landing/quick-start-section";
import { ScreenshotsSection } from "@/components/landing/screenshots-section";
import { WorksWithSection } from "@/components/landing/works-with-section";

/** The landing page (WS-02): Magic UI sections, all static with reduced motion. */
export default function HomePage() {
  return (
    <main className="flex flex-col">
      <HeroSection />
      <FlowSection />
      <WorksWithSection />
      <QuickStartSection />
      <ScreenshotsSection />
      <FeaturesSection />
      <NumbersSection />
      <CallToActionSection />
    </main>
  );
}
