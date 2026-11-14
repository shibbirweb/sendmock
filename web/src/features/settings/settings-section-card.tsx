import type * as React from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** A titled block of settings; with `onSave`, a Save / Discard footer. */
export function SettingsSectionCard({
  title,
  description,
  children,
  isDirty = false,
  isSaving = false,
  onSave,
  onDiscard,
  className,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  isDirty?: boolean;
  isSaving?: boolean;
  onSave?: () => void;
  onDiscard?: () => void;
  className?: string;
}) {
  const content = (
    <>
      <div className="grid gap-1 px-4 pt-4 sm:px-5">
        <h3 className="text-base font-semibold">{title}</h3>
        {description !== undefined && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="grid gap-5 px-4 py-4 sm:px-5">{children}</div>
    </>
  );

  if (onSave === undefined) {
    return (
      <section className={cn("rounded-lg border bg-card", className)}>
        {content}
      </section>
    );
  }

  return (
    <form
      noValidate
      aria-label={title}
      className={cn("rounded-lg border bg-card", className)}
      onSubmit={(submitEvent) => {
        submitEvent.preventDefault();
        onSave();
      }}
    >
      {content}
      <div className="flex items-center justify-end gap-2 border-t px-4 py-3 sm:px-5">
        {isDirty && (
          <span className="mr-auto text-xs text-muted-foreground">
            Unsaved changes
          </span>
        )}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={!isDirty || isSaving}
          onClick={onDiscard}
        >
          Discard
        </Button>
        <Button type="submit" size="sm" disabled={!isDirty || isSaving}>
          Save changes
        </Button>
      </div>
    </form>
  );
}
