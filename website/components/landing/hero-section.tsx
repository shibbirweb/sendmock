import Link from "next/link";

import { DemoLink } from "@/components/demo-link";
import { AnimatedShinyText } from "@/components/ui/animated-shiny-text";
import { DotPattern } from "@/components/ui/dot-pattern";
import { ShimmerButton } from "@/components/ui/shimmer-button";
import { cn } from "@/lib/utils";

export function HeroSection() {
  return (
    <section className="relative flex flex-col items-center gap-6 overflow-hidden px-4 pt-24 pb-16 text-center">
      <DotPattern
        className={cn(
          "-z-10 text-fd-muted-foreground/30",
          "[mask-image:radial-gradient(420px_circle_at_center,white,transparent)]",
        )}
      />
      <div className="rounded-full border bg-fd-card px-4 py-1 text-sm">
        <AnimatedShinyText>In development: UI preview with demo data</AnimatedShinyText>
      </div>
      <h1 className="max-w-3xl text-4xl font-bold tracking-tight sm:text-6xl">
        Catch every email, SMS, payment and webhook on your machine
      </h1>
      <p className="max-w-2xl text-lg text-fd-muted-foreground">
        One small binary that acts as a mail server, an SMS provider and a
        payment gateway for any app, shows everything in a clean web UI, and calls your webhooks
        automatically or on demand. PHP, Node, Python, Go, Java, Rust and more.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <DemoLink>
          <ShimmerButton className="shadow-lg">
            <span className="text-sm font-medium text-white">
              Try the live demo
            </span>
          </ShimmerButton>
        </DemoLink>
        <Link
          href="/docs"
          className="rounded-full border px-6 py-3 text-sm font-medium hover:bg-fd-accent"
        >
          Read the docs
        </Link>
      </div>
    </section>
  );
}
