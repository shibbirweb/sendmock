import type { LucideIcon } from "lucide-react";

type PagePlaceholderProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  plannedPhase: string;
};

/** Stand-in for a screen that is built in a later phase. */
export function PagePlaceholder({
  icon: PageIcon,
  title,
  description,
  plannedPhase,
}: PagePlaceholderProps) {
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div className="flex max-w-sm flex-col items-center gap-3 text-center">
        <span className="flex size-12 items-center justify-center rounded-xl bg-muted">
          <PageIcon className="size-6 text-muted-foreground" />
        </span>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
        <span className="rounded-full border px-2.5 py-0.5 text-xs text-muted-foreground">
          Coming in {plannedPhase}
        </span>
      </div>
    </div>
  );
}
