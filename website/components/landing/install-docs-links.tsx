import { ArrowRightIcon } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

/** A link to a docs page or section with the full steps for one way to install. */
export type InstallDocsLink = {
  label: string;
  docsPath: string;
};

/** Every way to install, step by step. */
export const installPageDocsPath = "/docs/install";

/** The other ways to install for a tab, then the whole Install page. */
export function InstallDocsLinks({
  docsLinks,
  className,
}: {
  docsLinks: InstallDocsLink[];
  className?: string;
}) {
  return (
    <nav
      aria-label="More ways to install"
      className={cn(
        "mt-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm",
        className,
      )}
    >
      {docsLinks.length > 0 && (
        <span className="text-fd-muted-foreground">More ways:</span>
      )}
      {docsLinks.map((docsLink) => (
        <Link
          key={docsLink.docsPath}
          href={docsLink.docsPath}
          className="underline underline-offset-4 hover:text-(--brand-text)"
        >
          {docsLink.label}
        </Link>
      ))}
      <Link
        href={installPageDocsPath}
        className="inline-flex items-center gap-1 font-medium text-(--brand-text) hover:underline hover:underline-offset-4"
      >
        All install options
        <ArrowRightIcon aria-hidden="true" className="size-3.5" />
      </Link>
    </nav>
  );
}
