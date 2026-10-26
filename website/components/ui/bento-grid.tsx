import { type ComponentPropsWithoutRef, type ReactNode } from "react";
import { BookOpenIcon } from "lucide-react";

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
      "group relative col-span-3 flex flex-col justify-between overflow-hidden rounded-xl",
      // light styles
      "bg-background [box-shadow:0_0_0_1px_rgba(0,0,0,.03),0_2px_4px_rgba(0,0,0,.05),0_12px_24px_rgba(0,0,0,.05)]",
      // dark styles
      "dark:bg-background transform-gpu dark:[box-shadow:0_-20px_80px_-20px_#ffffff1f_inset] dark:[border:1px_solid_rgba(255,255,255,.1)]",
      className,
    )}
    {...props}
  >
    <div>{background}</div>
    <div className="z-10 flex flex-col gap-1 p-4">
      <span className="mb-2 flex size-9 items-center justify-center rounded-lg border bg-fd-background shadow-sm">
        <Icon className="size-4.5 text-(--brand-from)" />
      </span>
      {/* The docs link sits beside the title, so the text never moves on hover. */}
      <div className="flex items-center gap-2">
        <h3 className="text-xl font-semibold text-fd-foreground">{name}</h3>
        <a
          href={href}
          aria-label={cta}
          title={cta}
          className="relative z-20 rounded-md p-1 text-fd-muted-foreground transition-colors hover:bg-fd-accent hover:text-(--brand-from)"
        >
          <BookOpenIcon aria-hidden className="size-4" />
        </a>
      </div>
      <p className="max-w-lg text-fd-muted-foreground">{description}</p>
    </div>

    <div className="pointer-events-none absolute inset-0 transform-gpu transition-all duration-300 group-hover:bg-black/3 group-hover:dark:bg-neutral-800/10" />
  </div>
);

export { BentoCard, BentoGrid };
