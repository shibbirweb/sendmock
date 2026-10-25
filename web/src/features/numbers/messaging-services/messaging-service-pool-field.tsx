import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useVirtualNumbers } from "@/lib/api/hooks/use-numbers-queries";
import type { MessagingService } from "@/lib/api/types";

/**
 * Checkbox per number. A number already in another service is marked, since
 * picking it moves it here (a number belongs to one service).
 */
export function MessagingServicePoolField({
  fieldIdPrefix,
  editedServiceSid,
  selectedNumberIds,
  messagingServices,
  onToggle,
}: {
  fieldIdPrefix: string;
  editedServiceSid: string | null;
  selectedNumberIds: string[];
  messagingServices: MessagingService[];
  onToggle: (numberId: string, isChecked: boolean) => void;
}) {
  const numbersQuery = useVirtualNumbers();
  const virtualNumbers = numbersQuery.data ?? [];
  const serviceNamesBySid = new Map(
    messagingServices.map((messagingService) => [
      messagingService.sid,
      messagingService.friendly_name,
    ]),
  );

  return (
    <fieldset className="grid gap-2">
      <legend className="mb-1 text-sm font-medium">Sender pool</legend>
      {virtualNumbers.length === 0 && (
        <p className="text-xs text-muted-foreground">
          No numbers yet. Sends through this service get a generated number.
        </p>
      )}
      {virtualNumbers.map((virtualNumber) => {
        const currentServiceSid = virtualNumber.messaging_service_sid;
        const isSelected = selectedNumberIds.includes(virtualNumber.id);
        const movesFromName =
          isSelected &&
          currentServiceSid !== null &&
          currentServiceSid !== editedServiceSid
            ? (serviceNamesBySid.get(currentServiceSid) ?? currentServiceSid)
            : null;
        const checkboxId = `${fieldIdPrefix}-pool-${virtualNumber.id}`;

        return (
          <div key={virtualNumber.id} className="flex items-start gap-2">
            <Checkbox
              id={checkboxId}
              className="mt-0.5"
              checked={isSelected}
              onCheckedChange={(checkedState) => {
                onToggle(virtualNumber.id, checkedState === true);
              }}
            />
            <Label htmlFor={checkboxId} className="grid gap-0.5 font-normal">
              <span>
                <span className="font-mono">{virtualNumber.number}</span>{" "}
                <span className="text-muted-foreground">
                  {virtualNumber.label}
                </span>
              </span>
              {movesFromName !== null && (
                <span className="text-xs text-muted-foreground">
                  Moves here from {movesFromName}
                </span>
              )}
            </Label>
          </div>
        );
      })}
    </fieldset>
  );
}
