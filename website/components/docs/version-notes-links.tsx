"use client";

import { ArrowUpCircleIcon, SparklesIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

/**
 * The version's release notes and upgrade guide, under the Version menu in
 * the docs sidebar (WS-14.1). usePathname leaves out the base path.
 */
export function VersionNotesLinks({
  whatsNewLabel,
}: {
  whatsNewLabel: string;
}) {
  const pagePath = usePathname().replace(/\/$/, "");
  const versionNotesLinks = [
    { label: whatsNewLabel, href: "/docs/whats-new", Icon: SparklesIcon },
    { label: "Upgrade guide", href: "/docs/upgrade", Icon: ArrowUpCircleIcon },
  ];

  return (
    <nav aria-label="This version" className="mt-2 grid gap-0.5">
      {versionNotesLinks.map(({ label, href, Icon }) => {
        const isCurrentPage = pagePath === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={isCurrentPage ? "page" : undefined}
            className={cn(
              "flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-fd-muted-foreground transition-colors hover:bg-fd-accent/50 hover:text-fd-accent-foreground",
              isCurrentPage && "bg-fd-primary/10 font-medium text-fd-primary",
            )}
          >
            <Icon aria-hidden="true" className="size-4 shrink-0" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
