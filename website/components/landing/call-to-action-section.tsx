import { GitHubLogoIcon } from "@radix-ui/react-icons";
import Link from "next/link";

import { DemoLink } from "@/components/demo-link";
import { SendMockLogo } from "@/components/sendmock-logo";
import { ShimmerButton } from "@/components/ui/shimmer-button";
import { repositoryUrl } from "@/lib/community-links";

import { CopyCommandButton } from "./copy-command-button";

const quickInstallCommand = "brew install shibbirweb/tap/sendmock";

/** A soft brand glow at the top of the card, from the theme's brand tokens. */
const brandGlowStyle = {
  backgroundImage:
    "radial-gradient(60% 55% at 50% 0%, color-mix(in oklab, var(--brand-from) 22%, transparent), transparent 70%)",
};

/** A faint dot grid in the border colour, faded out towards the bottom. */
const dotGridStyle = {
  backgroundImage:
    "radial-gradient(var(--color-fd-border) 1px, transparent 1px)",
  backgroundSize: "18px 18px",
  maskImage: "linear-gradient(to bottom, black, transparent 75%)",
};

export function CallToActionSection() {
  return (
    <section
      aria-labelledby="call-to-action-heading"
      className="mx-auto w-full max-w-5xl px-4 py-20"
    >
      <div className="relative overflow-hidden rounded-3xl border bg-fd-card px-6 py-14 text-center shadow-sm sm:px-12">
        <div aria-hidden className="absolute inset-0" style={dotGridStyle} />
        <div aria-hidden className="absolute inset-0" style={brandGlowStyle} />
        <div className="relative flex flex-col items-center gap-6">
          <SendMockLogo className="size-14" />
          <p className="rounded-full border bg-fd-background/70 px-3 py-1 text-xs font-medium text-fd-muted-foreground">
            Runs on your machine. No account, no cloud.
          </p>
          <h2
            id="call-to-action-heading"
            className="max-w-3xl text-3xl font-bold tracking-tight text-balance sm:text-5xl"
          >
            Test the messages your app sends,{" "}
            <span className="bg-linear-to-r from-(--brand-from) to-(--brand-to) bg-clip-text text-transparent">
              before your users do
            </span>
          </h2>
          <p className="max-w-xl text-fd-muted-foreground sm:text-lg">
            Try every screen with demo data in your browser, or point your app
            at SendMock and see every email, SMS, payment and webhook it sends.
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
              className="rounded-full border bg-fd-background px-6 py-3 text-sm font-medium hover:bg-fd-accent"
            >
              Read the docs
            </Link>
            <a
              href={repositoryUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full border bg-fd-background px-6 py-3 text-sm font-medium hover:bg-fd-accent"
            >
              <GitHubLogoIcon aria-hidden className="size-4" />
              Star on GitHub
            </a>
          </div>
          <div className="flex items-center gap-2 rounded-lg border bg-fd-background/80 py-1.5 ps-4 pe-1.5 font-mono text-sm">
            <span aria-hidden className="text-fd-muted-foreground">
              $
            </span>
            <code>{quickInstallCommand}</code>
            <CopyCommandButton command={quickInstallCommand} />
          </div>
        </div>
      </div>
    </section>
  );
}
