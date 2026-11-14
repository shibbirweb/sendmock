import { ArrowDownIcon, TerminalIcon } from "lucide-react";

/** The quick start section's anchor, shared by the hero link and the section. */
export const quickStartSectionId = "quick-start";

/**
 * A plain anchor to the install terminal further down, so it works without JavaScript; the
 * brand gradient ring sets it apart from the demo and docs buttons beside it.
 */
export function QuickStartLink() {
  return (
    <a
      href={`#${quickStartSectionId}`}
      className="group rounded-full bg-linear-to-r from-(--brand-from) to-(--brand-to) p-px shadow-sm transition-shadow outline-none hover:shadow-md focus-visible:ring-2 focus-visible:ring-(--brand-from) focus-visible:ring-offset-2 focus-visible:ring-offset-fd-background"
    >
      <span className="flex items-center gap-2 rounded-full bg-fd-background px-6 py-3 text-sm font-medium">
        <TerminalIcon
          aria-hidden="true"
          className="size-4 text-(--brand-text)"
        />
        Quick start
        <ArrowDownIcon
          aria-hidden="true"
          className="size-4 text-(--brand-text) transition-transform group-hover:translate-y-0.5 group-focus-visible:translate-y-0.5"
        />
      </span>
    </a>
  );
}
