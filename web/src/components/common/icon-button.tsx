import type * as React from "react";

import { Button } from "@/components/ui/button";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  formatAriaKeyShortcuts,
  formatShortcutKey,
} from "@/lib/keyboard/format-shortcut-key";
import {
  trackInputModality,
  wasFocusMovedByKeyboard,
} from "@/lib/keyboard/input-modality";

trackInputModality();

/**
 * A dialog, sheet or menu moves focus by itself when it opens or closes; a
 * tooltip opened then would stay up and take the Escape meant for the dialog.
 */
function openTooltipOnlyForKeyboardFocus(focusEvent: React.FocusEvent) {
  if (!wasFocusMovedByKeyboard()) {
    focusEvent.preventDefault();
  }
}

type IconTooltipProps = {
  /** The action, shown in the tooltip and used as the accessible name. */
  label: string;
  /** Keys from the shortcut catalog, e.g. `appShortcuts.deleteOpenItem.keys`. */
  shortcutKeys?: string[];
  /** A short note after the label, e.g. where a link goes. */
  hint?: string;
  side?: React.ComponentProps<typeof TooltipContent>["side"];
  children: React.ReactElement;
};

/**
 * Names an icon-only control on hover and keyboard focus, with its shortcut
 * when it has one (UI-13.1, UI-13.2). The child keeps the label as its
 * accessible name.
 */
export function IconTooltip({
  label,
  shortcutKeys,
  hint,
  side,
  children,
}: IconTooltipProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild onFocus={openTooltipOnlyForKeyboardFocus}>
        {children}
      </TooltipTrigger>
      <TooltipContent side={side}>
        {hint === undefined ? label : `${label}. ${hint}`}
        {shortcutKeys !== undefined && (
          <KbdGroup>
            {shortcutKeys.map((shortcutKey) => (
              <Kbd key={shortcutKey}>{formatShortcutKey(shortcutKey)}</Kbd>
            ))}
          </KbdGroup>
        )}
      </TooltipContent>
    </Tooltip>
  );
}

type IconButtonProps = Omit<
  React.ComponentProps<typeof Button>,
  "aria-label" | "size"
> & {
  label: string;
  shortcutKeys?: string[];
  hint?: string;
  tooltipSide?: IconTooltipProps["side"];
  size?: "icon" | "icon-xs" | "icon-sm" | "icon-lg";
};

/**
 * The only way to build a button that shows just an icon: it requires the
 * label, which becomes its tooltip and accessible name (UI-13.3).
 */
export function IconButton({
  label,
  shortcutKeys,
  hint,
  tooltipSide,
  size = "icon",
  ...buttonProps
}: IconButtonProps) {
  return (
    <IconTooltip
      label={label}
      shortcutKeys={shortcutKeys}
      hint={hint}
      side={tooltipSide}
    >
      <Button
        size={size}
        aria-label={label}
        aria-keyshortcuts={
          shortcutKeys === undefined
            ? undefined
            : formatAriaKeyShortcuts(shortcutKeys)
        }
        {...buttonProps}
      />
    </IconTooltip>
  );
}
