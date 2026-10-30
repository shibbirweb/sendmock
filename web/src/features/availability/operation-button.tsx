import type * as React from "react";

import { Button } from "@/components/ui/button";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useOperationAvailability } from "@/lib/api/hooks/use-operation-availability";

type OperationButtonProps = React.ComponentProps<typeof Button> & {
  /** The operation the button runs, e.g. `POST /api/v1/emails/{emailId}/reply`. */
  operationKey: string;
  /** What the button does, kept in its accessible name while it is disabled. */
  actionName: string;
};

/**
 * A button for one operation: disabled with "Available in Phase N" as its tooltip and
 * in its accessible name while the running SendMock does not serve it (UI-12.2).
 */
export function OperationButton({
  operationKey,
  actionName,
  ...buttonProps
}: OperationButtonProps) {
  const availability = useOperationAvailability(operationKey);
  if (availability.isAvailable) {
    return <Button {...buttonProps} />;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {/* A disabled button gets no pointer or focus events, so the tooltip hangs on a wrapper. */}
        <span tabIndex={0} className="inline-flex rounded-md">
          <Button
            {...buttonProps}
            disabled
            onClick={undefined}
            aria-label={`${actionName}: ${availability.unavailableLabel}`}
          />
        </span>
      </TooltipTrigger>
      <TooltipContent>{availability.unavailableLabel}</TooltipContent>
    </Tooltip>
  );
}

type OperationMenuItemProps = React.ComponentProps<typeof DropdownMenuItem> & {
  operationKey: string;
};

/** A menu item for one operation, disabled and marked "Available in Phase N" until served. */
export function OperationMenuItem({
  operationKey,
  children,
  ...menuItemProps
}: OperationMenuItemProps) {
  const availability = useOperationAvailability(operationKey);
  if (availability.isAvailable) {
    return <DropdownMenuItem {...menuItemProps}>{children}</DropdownMenuItem>;
  }

  return (
    <DropdownMenuItem {...menuItemProps} disabled onSelect={undefined}>
      {children}
      <span className="ml-auto text-xs text-muted-foreground">
        {availability.unavailableLabel}
      </span>
    </DropdownMenuItem>
  );
}
