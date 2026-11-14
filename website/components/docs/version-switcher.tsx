"use client";

import { CheckIcon, ChevronsUpDownIcon } from "lucide-react";
import { usePathname } from "next/navigation";
import { DropdownMenu } from "radix-ui";

import {
  currentDocsVersion,
  docsVersionLinks,
} from "@/lib/current-docs-version";
import { cn } from "@/lib/utils";

/**
 * The docs version picker at the top of the sidebar (WS-03.6). Picking a
 * version opens the same page there; usePathname leaves out the base path.
 */
export function VersionSwitcher() {
  const pagePath = usePathname().replace(/^\//, "");

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        aria-label={`Docs version: ${currentDocsVersion?.label ?? ""}`}
        className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg border bg-fd-secondary/50 px-3 py-2 text-start text-sm font-medium text-fd-foreground transition-colors hover:bg-fd-accent"
      >
        <span className="flex flex-col">
          <span className="text-xs font-normal text-fd-muted-foreground">
            Version
          </span>
          {currentDocsVersion?.label}
        </span>
        <ChevronsUpDownIcon
          aria-hidden="true"
          className="size-4 shrink-0 text-fd-muted-foreground"
        />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={4}
          className="z-50 min-w-(--radix-dropdown-menu-trigger-width) rounded-lg border bg-fd-popover p-1 text-sm text-fd-popover-foreground shadow-md"
        >
          {docsVersionLinks.map((versionLink) => {
            const isCurrentVersion =
              versionLink.key === currentDocsVersion?.key;

            return (
              <DropdownMenu.Item key={versionLink.key} asChild>
                <a
                  href={`${versionLink.href}${pagePath}`}
                  aria-current={isCurrentVersion ? "page" : undefined}
                  className={cn(
                    "flex cursor-pointer items-center justify-between gap-4 rounded-md px-2 py-1.5 outline-none data-highlighted:bg-fd-accent",
                    isCurrentVersion && "font-medium",
                  )}
                >
                  {versionLink.label}
                  {isCurrentVersion && (
                    <CheckIcon aria-hidden="true" className="size-4" />
                  )}
                </a>
              </DropdownMenu.Item>
            );
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
