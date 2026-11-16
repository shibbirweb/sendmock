import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

/**
 * The tick box on a list row (UI-14.1): shown on hover, on keyboard focus and
 * while anything is checked, and always on touch screens. Clicks stay on the
 * box, so ticking a row does not open it.
 */
export function ListRowCheckbox({
  itemLabel,
  isChecked,
  isAnyChecked,
  onCheckedChange,
  className,
}: {
  /** Names the row for screen readers, e.g. "conversation with +8801700000000". */
  itemLabel: string;
  isChecked: boolean;
  isAnyChecked: boolean;
  onCheckedChange: (isChecked: boolean) => void;
  className?: string;
}) {
  return (
    <Checkbox
      checked={isChecked}
      onCheckedChange={(checkedState) => {
        onCheckedChange(checkedState === true);
      }}
      onClick={(clickEvent) => {
        clickEvent.stopPropagation();
      }}
      onKeyDown={(keyEvent) => {
        keyEvent.stopPropagation();
      }}
      aria-label={`Select ${itemLabel}`}
      className={cn(
        "relative z-10 opacity-0 group-hover/list-row:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100",
        (isChecked || isAnyChecked) && "opacity-100",
        className,
      )}
    />
  );
}
