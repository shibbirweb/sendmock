import { InfoIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export type PlatformRequirement = {
  /** What has to be on the computer first, as shown: "Node.js 18 or newer". */
  name: string;
  url: string;
};

/** Says what a runner tab needs on the computer, where the other tabs show their downloads. */
export function PlatformRequirementNote({
  requirement,
  className,
}: {
  requirement: PlatformRequirement;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "mt-6 flex items-center justify-center gap-2 text-sm text-fd-muted-foreground",
        className,
      )}
    >
      <InfoIcon aria-hidden="true" className="size-4 text-(--brand-text)" />
      <span>
        Needs{" "}
        <a
          href={requirement.url}
          className="font-medium text-fd-foreground underline underline-offset-4 hover:text-(--brand-text)"
        >
          {requirement.name}
        </a>{" "}
        on your computer.
      </span>
    </p>
  );
}
