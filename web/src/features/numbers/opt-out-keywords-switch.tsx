import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

/** Opt-out keywords for one number or Messaging Service (SM-23.3). */
export function OptOutKeywordsSwitch({
  switchId,
  hint,
  isChecked,
  onCheckedChange,
}: {
  switchId: string;
  hint: string;
  isChecked: boolean;
  onCheckedChange: (isChecked: boolean) => void;
}) {
  return (
    <div className="flex items-start gap-2">
      <Switch
        id={switchId}
        checked={isChecked}
        onCheckedChange={onCheckedChange}
      />
      <div className="grid gap-0.5">
        <Label htmlFor={switchId}>Opt-out keywords</Label>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
    </div>
  );
}
