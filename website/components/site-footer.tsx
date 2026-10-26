import { GitHubLogoIcon } from "@radix-ui/react-icons";
import Link from "next/link";

import { SendMockLogo } from "@/components/sendmock-logo";
import { basePath } from "@/lib/base-path";
import {
  bugReportUrl,
  changelogUrl,
  featureRequestUrl,
  repositoryUrl,
  securityReportUrl,
} from "@/lib/community-links";

type FooterLink = {
  label: string;
  href: string;
  /** GitHub and the demo app are outside the Next.js site. */
  isExternal?: boolean;
};

const footerColumns: { heading: string; links: FooterLink[] }[] = [
  {
    heading: "Product",
    links: [
      { label: "Docs", href: "/docs" },
      { label: "API reference", href: "/api" },
      { label: "CLI", href: "/cli" },
      { label: "MCP", href: "/mcp" },
      { label: "Playground", href: "/playground" },
      { label: "Live demo", href: `${basePath}/demo/`, isExternal: true },
    ],
  },
  {
    heading: "Get started",
    links: [
      { label: "Install", href: "/docs/install" },
      { label: "Getting started", href: "/docs/getting-started" },
      { label: "Connect your app", href: "/docs/connect" },
      { label: "Docker", href: "/docs/connect/docker" },
    ],
  },
  {
    heading: "Community",
    links: [
      { label: "Report an issue", href: bugReportUrl, isExternal: true },
      { label: "Request a feature", href: featureRequestUrl, isExternal: true },
      {
        label: "Report a security issue",
        href: securityReportUrl,
        isExternal: true,
      },
      { label: "What's new", href: changelogUrl, isExternal: true },
      { label: "Star on GitHub", href: repositoryUrl, isExternal: true },
    ],
  },
];

const footerLinkClassName =
  "text-fd-muted-foreground transition-colors hover:text-fd-foreground";

function FooterLinkItem({ footerLink }: { footerLink: FooterLink }) {
  if (footerLink.isExternal) {
    // GitHub opens in a new tab; the demo is part of this site.
    const isGithubLink = footerLink.href.startsWith(repositoryUrl);
    return (
      <a
        href={footerLink.href}
        target={isGithubLink ? "_blank" : undefined}
        rel={isGithubLink ? "noreferrer" : undefined}
        className={footerLinkClassName}
      >
        {footerLink.label}
      </a>
    );
  }

  return (
    <Link href={footerLink.href} className={footerLinkClassName}>
      {footerLink.label}
    </Link>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t bg-fd-card/40">
      <div className="mx-auto grid w-full max-w-5xl gap-10 px-4 py-12 text-sm lg:grid-cols-[1.3fr_3fr]">
        <div className="flex flex-col gap-4">
          <Link href="/" className="flex w-fit items-center gap-2">
            <SendMockLogo className="size-7" />
            <span className="text-base font-semibold">SendMock</span>
          </Link>
          <p className="max-w-xs text-fd-muted-foreground">
            A local sandbox for email, SMS, payments and webhooks. Catch every
            message your app sends, on your own machine.
          </p>
          <a
            href={repositoryUrl}
            target="_blank"
            rel="noreferrer"
            aria-label="SendMock on GitHub"
            className="w-fit rounded-md border p-2 text-fd-muted-foreground transition-colors hover:bg-fd-accent hover:text-fd-foreground"
          >
            <GitHubLogoIcon aria-hidden className="size-4" />
          </a>
        </div>
        <nav aria-label="Footer" className="grid gap-8 sm:grid-cols-3">
          {footerColumns.map((footerColumn) => (
            <div key={footerColumn.heading} className="flex flex-col gap-3">
              <h2 className="font-semibold">{footerColumn.heading}</h2>
              <ul className="flex flex-col gap-2">
                {footerColumn.links.map((footerLink) => (
                  <li key={footerLink.label}>
                    <FooterLinkItem footerLink={footerLink} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>
      <div className="border-t">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-6 text-xs text-fd-muted-foreground">
          <p>© {new Date().getFullYear()} SendMock</p>
          <p>Built for developers who test what their app sends.</p>
        </div>
      </div>
    </footer>
  );
}
