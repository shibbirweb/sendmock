import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { type AppEventType, appEventTypes } from "@/lib/api/types";

const eventAreaLabels: Record<string, string> = {
  email: "Email",
  sms: "SMS",
  verify: "Verify",
  http: "HTTP",
  payment: "Payments",
  checkout: "Checkout",
  webhook: "Webhooks",
  test: "Test",
};

/** `webhook.delivered` only drives the live log; a rule on it could loop. */
const unselectableEvents: AppEventType[] = ["webhook.delivered"];

/** Events grouped by the part before the dot: email, sms, verify, ... */
function groupEventsByArea(): [areaKey: string, events: AppEventType[]][] {
  const eventsByArea = new Map<string, AppEventType[]>();
  const selectableEvents = appEventTypes.filter(
    (eventType) => !unselectableEvents.includes(eventType),
  );
  for (const eventType of selectableEvents) {
    const areaKey = eventType.split(".")[0] ?? eventType;
    eventsByArea.set(areaKey, [
      ...(eventsByArea.get(areaKey) ?? []),
      eventType,
    ]);
  }

  return [...eventsByArea.entries()];
}

const eventAreas = groupEventsByArea();

/** Which events fire the rule, as checkboxes per area. */
export function RuleEventsPicker({
  pickerId,
  selectedEvents,
  onChange,
}: {
  pickerId: string;
  selectedEvents: AppEventType[];
  onChange: (nextEvents: AppEventType[]) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {eventAreas.map(([areaKey, areaEvents]) => (
        <fieldset key={areaKey} className="grid content-start gap-1.5">
          <legend className="mb-1 text-xs font-medium text-muted-foreground">
            {eventAreaLabels[areaKey] ?? areaKey}
          </legend>
          {areaEvents.map((eventType) => {
            const checkboxId = `${pickerId}-${eventType}`;

            return (
              <div key={eventType} className="flex items-center gap-2">
                <Checkbox
                  id={checkboxId}
                  checked={selectedEvents.includes(eventType)}
                  onCheckedChange={(checkedState) => {
                    onChange(
                      checkedState === true
                        ? [...selectedEvents, eventType]
                        : selectedEvents.filter(
                            (selectedEvent) => selectedEvent !== eventType,
                          ),
                    );
                  }}
                />
                <Label
                  htmlFor={checkboxId}
                  className="font-mono text-xs font-normal"
                >
                  {eventType}
                </Label>
              </div>
            );
          })}
        </fieldset>
      ))}
    </div>
  );
}
