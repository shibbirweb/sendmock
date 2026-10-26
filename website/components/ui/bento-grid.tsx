import { type ComponentPropsWithoutRef, type ReactNode } from "react";
import { ArrowUpRightIcon } from "lucide-react";

import { cn } from "@/lib/utils";

interface BentoGridProps extends ComponentPropsWithoutRef<"div"> {
  children: ReactNode;
  className?: string;
}

interface BentoCardProps extends ComponentPropsWithoutRef<"div"> {
  name: string;
  className: string;
  background: ReactNode;
  Icon: React.ElementType;
  description: string;
  href: string;
  cta: string;
}

const BentoGrid = ({ children, className, ...props }: BentoGridProps) => {
  return (
    <div
      className={cn(
        "grid w-full auto-rows-[22rem] grid-cols-3 gap-4",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
};

const BentoCard = ({
  name,
  className,
  background,
  Icon,
  description,
  href,
  cta,
  ...props
}: BentoCardProps) => (
  <div
    key={name}
    className={cn(
      // A preview panel of one fixed height, then the text: the card is as tall
      // as its content, and every card's text starts on the same line.
      "group relative col-span-3 flex flex-col overflow-hidden rounded-xl",
      // light styles
      "bg-background [box-shadow:0_0_0_1px_rgba(0,0,0,.03),0_2px_4px_rgba(0,0,0,.05),0_12px_24px_rgba(0,0,0,.05)]",
      // dark styles
      "dark:bg-background transform-gpu dark:[box-shadow:0_-20px_80px_-20px_#ffffff1f_inset] dark:[border:1px_solid_rgba(255,255,255,.1)]",
      className,
    )}
    {...props}
  >
    <div className="relative h-44 shrink-0 overflow-hidden border-b bg-fd-muted/40">
      {background}
    </div>
    <div className="z-10 flex flex-col gap-2 p-5">
      <div className="flex items-center gap-2.5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border bg-fd-background shadow-sm">
          <Icon className="size-4 text-(--brand-text)" />
        </span>
        <h3 className="text-xl font-semibold text-fd-foreground">{name}</h3>
        {/* Only the arrow links to the docs; the card itself is not a link. */}
        <a
          href={href}
          aria-label={cta}
          title={cta}
          className="ms-auto rounded-md p-1 text-fd-muted-foreground transition-colors outline-none hover:bg-fd-accent hover:text-(--brand-text) focus-visible:ring-2 focus-visible:ring-fd-ring"
        >
          <ArrowUpRightIcon aria-hidden className="size-4" />
        </a>
      </div>
      {/* One text width in every card, so every description wraps the same way. */}
      <p className="max-w-72 text-fd-muted-foreground">{description}</p>
    </div>
  </div>
);

export { BentoCard, BentoGrid };
