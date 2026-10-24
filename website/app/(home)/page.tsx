import { FeaturesSection } from "@/components/landing/features-section";
import { HeroSection } from "@/components/landing/hero-section";
import { QuickStartSection } from "@/components/landing/quick-start-section";
import { WorksWithSection } from "@/components/landing/works-with-section";

/** Landing page draft (U0); the full Magic UI design lands in Phase U3. */
export default function HomePage() {
  return (
    <main className="flex flex-col">
      <HeroSection />
      <WorksWithSection />
      <QuickStartSection />
      <FeaturesSection />
    </main>
  );
}
