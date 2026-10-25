import Link from "next/link";

import {
  bugReportUrl,
  changelogUrl,
  featureRequestUrl,
  repositoryUrl,
  securityReportUrl,
} from "@/lib/community-links";

const siteLinks = [
  { label: "Docs", href: "/docs" },
  { label: "API reference", href: "/api" },
  { label: "Playground", href: "/playground" },
];

const communityLinks = [
  { label: "Report an issue", href: bugReportUrl },
  { label: "Request a feature", href: featureRequestUrl },
  { label: "Report a security issue", href: securityReportUrl },
  { label: "What's new", href: changelogUrl },
  { label: "Star on GitHub", href: repositoryUrl },
];

export function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap justify-between gap-6 px-4 py-8 text-sm">
        <p className="text-fd-muted-foreground">
          SendMock: a local sandbox for email, SMS, payments and webhooks.
        </p>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2">
          {siteLinks.map((siteLink) => (
            <Link
              key={siteLink.href}
              href={siteLink.href}
              className="text-fd-muted-foreground hover:text-fd-foreground"
            >
              {siteLink.label}
            </Link>
          ))}
          {communityLinks.map((communityLink) => (
            <a
              key={communityLink.label}
              href={communityLink.href}
              target="_blank"
              rel="noreferrer"
              className="text-fd-muted-foreground hover:text-fd-foreground"
            >
              {communityLink.label}
            </a>
          ))}
        </nav>
      </div>
    </footer>
  );
}
