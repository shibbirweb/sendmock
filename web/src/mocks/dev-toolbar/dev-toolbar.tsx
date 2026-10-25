import { useQueryClient } from "@tanstack/react-query";
import {
  FlaskConicalIcon,
  MailPlusIcon,
  MessageSquarePlusIcon,
  RotateCcwIcon,
} from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  type MockConditions,
  readMockConditions,
  subscribeToMockConditions,
  updateMockConditions,
} from "@/mocks/conditions/mock-conditions";
import { replaceMockDatabase } from "@/mocks/db/mock-database";
import { DevToolbarSelect } from "@/mocks/dev-toolbar/dev-toolbar-select";
import {
  generateSampleEmail,
  generateSampleSms,
} from "@/mocks/realtime/mock-event-generator";

function useMockConditions(): MockConditions {
  return React.useSyncExternalStore(
    subscribeToMockConditions,
    readMockConditions,
  );
}

/**
 * Demo controls, only bundled in mock mode: latency, forced API errors, data
 * size, live traffic and one-click samples (UI-02.3).
 */
export function DevToolbar() {
  const queryClient = useQueryClient();
  const mockConditions = useMockConditions();

  const refreshAllData = () => {
    void queryClient.invalidateQueries();
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          size="sm"
          variant="ghost"
          aria-label="Demo controls"
          className="gap-2"
        >
          <FlaskConicalIcon />
          <span className="hidden lg:inline">Demo</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="grid w-80 gap-4">
        <div className="grid gap-1">
          <h3 className="text-sm font-medium">Demo controls</h3>
          <p className="text-xs text-muted-foreground">
            Only in demo mode. Change how the in-browser mock API behaves.
          </p>
        </div>
        <div className="grid gap-2">
          <Label>Latency: {mockConditions.latencyMs} ms</Label>
          <Slider
            aria-label="Latency"
            min={0}
            max={3000}
            step={50}
            value={[mockConditions.latencyMs]}
            onValueChange={([latencyMs]) => {
              updateMockConditions({ latencyMs: latencyMs ?? 0 });
            }}
          />
        </div>
        <DevToolbarSelect
          label="API responses"
          value={mockConditions.simulatedApiError}
          options={[
            { value: "none", label: "Normal" },
            { value: "server-error", label: "Always 500 server error" },
            { value: "not-found", label: "Always 404 not found" },
          ]}
          onValueChange={(simulatedApiError) => {
            updateMockConditions({ simulatedApiError });
            refreshAllData();
          }}
        />
        <DevToolbarSelect
          label="Data set"
          value={mockConditions.dataSize}
          options={[
            { value: "standard", label: "Standard demo data" },
            { value: "large", label: "Large (5,000 emails)" },
            { value: "empty", label: "Empty (no traffic)" },
          ]}
          onValueChange={(dataSize) => {
            updateMockConditions({ dataSize });
            replaceMockDatabase(dataSize);
            refreshAllData();
          }}
        />
        <div className="flex items-center justify-between">
          <Label htmlFor="realtime-traffic">Live traffic every 12 s</Label>
          <Switch
            id="realtime-traffic"
            checked={mockConditions.isRealtimeEnabled}
            onCheckedChange={(isRealtimeEnabled) => {
              updateMockConditions({ isRealtimeEnabled });
            }}
          />
        </div>
        <div className="flex items-center justify-between">
          <Label htmlFor="running-in-container">Running in Docker</Label>
          <Switch
            id="running-in-container"
            checked={mockConditions.isRunningInContainer}
            onCheckedChange={(isRunningInContainer) => {
              updateMockConditions({ isRunningInContainer });
              refreshAllData();
            }}
          />
        </div>
        <Separator />
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" size="sm" onClick={generateSampleEmail}>
            <MailPlusIcon />
            Sample email
          </Button>
          <Button variant="outline" size="sm" onClick={generateSampleSms}>
            <MessageSquarePlusIcon />
            Sample SMS
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="col-span-2"
            onClick={() => {
              replaceMockDatabase(mockConditions.dataSize);
              refreshAllData();
            }}
          >
            <RotateCcwIcon />
            Reset demo data
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
