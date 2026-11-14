import { Link } from "@tanstack/react-router";
import { ArrowRightIcon } from "lucide-react";

import { CopyButton } from "@/components/common/copy-button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useAppLocation } from "@/features/onboarding/use-app-location";
import { useAppInfo } from "@/lib/api/hooks/use-system-queries";
import {
  buildConnectValues,
  type ConnectArea,
  readConnectTarget,
} from "@/lib/onboarding/build-connect-values";
import type { AppLocation } from "@/lib/settings/build-connection-snippets";
import { cn } from "@/lib/utils";

const shortAppLocationLabels: Record<AppLocation, string> = {
  "this-machine": "This machine",
  "docker-host": "Docker host",
  compose: "Compose",
};

/**
 * How to connect: this instance's host and ports for one area, each with a
 * copy button, and a switch for where the app runs (UI-04.1, UI-04.3).
 */
export function ConnectHint({
  connectArea,
  className,
}: {
  connectArea: ConnectArea;
  className?: string;
}) {
  const appInfoQuery = useAppInfo();
  const [appLocation, setAppLocation] = useAppLocation();
  const connectValues = buildConnectValues(
    connectArea,
    readConnectTarget(appInfoQuery.data, appLocation),
  );

  return (
    <div
      className={cn(
        "grid w-full max-w-md gap-3 rounded-lg border bg-muted/30 p-3 text-left",
        className,
      )}
    >
      <div className="grid gap-1.5">
        <span className="text-xs text-muted-foreground">
          Where does your app run?
        </span>
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          aria-label="Where does your app run?"
          value={appLocation}
          onValueChange={(selectedLocation) => {
            if (selectedLocation) {
              setAppLocation(selectedLocation as AppLocation);
            }
          }}
          className="w-full"
        >
          {(Object.keys(shortAppLocationLabels) as AppLocation[]).map(
            (locationOption) => (
              <ToggleGroupItem
                key={locationOption}
                value={locationOption}
                className="flex-1 text-xs"
              >
                {shortAppLocationLabels[locationOption]}
              </ToggleGroupItem>
            ),
          )}
        </ToggleGroup>
      </div>
      <dl className="grid gap-2">
        {connectValues.map((connectValue) => (
          <div key={connectValue.label} className="grid gap-0.5">
            <dt className="text-xs text-muted-foreground">
              {connectValue.label}
            </dt>
            <dd className="flex items-center gap-1 rounded-md border bg-background py-0.5 pr-0.5 pl-2">
              <code className="min-w-0 flex-1 truncate font-mono text-xs">
                {connectValue.connectValue}
              </code>
              <CopyButton
                copyText={connectValue.connectValue}
                label={`Copy ${connectValue.label}`}
              />
            </dd>
          </div>
        ))}
      </dl>
      <Link
        to="/settings"
        search={{ section: "connection" }}
        className="inline-flex items-center gap-1 justify-self-start rounded-sm text-xs font-medium underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        More snippets
        <ArrowRightIcon className="size-3" />
      </Link>
    </div>
  );
}
