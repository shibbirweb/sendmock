import { cn } from "@/lib/utils";

type SectionHeadingProps = {
  /** The h2's id, which the section names itself by (aria-labelledby). */
  headingId: string;
  /** A short brand-coloured label above the title, such as "Features". */
  eyebrow: string;
  title: string;
  description: string;
  className?: string;
};

/**
 * The one heading style every main landing section uses: label, title and a
 * line of text, centred, so the sections read as one page.
 */
export function SectionHeading({
  headingId,
  eyebrow,
  title,
  description,
  className,
}: SectionHeadingProps) {
  return (
    <div
      className={cn("flex flex-col items-center gap-3 text-center", className)}
    >
      <p className="text-sm font-semibold tracking-wide text-(--brand-text) uppercase">
        {eyebrow}
      </p>
      <h2
        id={headingId}
        className="max-w-3xl text-3xl font-bold tracking-tight text-balance sm:text-4xl"
      >
        {title}
      </h2>
      <p className="max-w-2xl text-balance text-fd-muted-foreground sm:text-lg">
        {description}
      </p>
    </div>
  );
}
