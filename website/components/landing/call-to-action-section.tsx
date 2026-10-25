import Link from "next/link";

import { DemoLink } from "@/components/demo-link";
import { ShimmerButton } from "@/components/ui/shimmer-button";

export function CallToActionSection() {
  return (
    <section
      aria-labelledby="call-to-action-heading"
      className="mx-auto flex w-full max-w-4xl flex-col items-center gap-5 px-4 py-20 text-center"
    >
      <h2
        id="call-to-action-heading"
        className="text-3xl font-bold tracking-tight"
      >
        Test the messages your app sends, before your users do
      </h2>
      <p className="max-w-xl text-fd-muted-foreground">
        Try every screen with demo data in your browser, or read how to point
        your app at SendMock.
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
