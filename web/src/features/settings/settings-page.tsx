import { useSearch } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AboutSection } from "@/features/settings/sections/about-section";
import { ChaosSection } from "@/features/settings/sections/chaos-section";
import { ConnectionSection } from "@/features/settings/sections/connection-section";
import { EmailSection } from "@/features/settings/sections/email-section";
import { GeneralSection } from "@/features/settings/sections/general-section";
import { OpenedEventsSection } from "@/features/settings/sections/opened-events-section";
import { OtpPatternsSection } from "@/features/settings/sections/otp-patterns-section";
import { SeedSection } from "@/features/settings/sections/seed-section";
import { PaymentsSection } from "@/features/settings/sections/payments-section";
import { SmsSection } from "@/features/settings/sections/sms-section";
import { SettingsNav } from "@/features/settings/settings-nav";
import {
  isChaosActive,
  type SettingsSectionId,
} from "@/features/settings/settings-sections";
import { useAppSettings } from "@/lib/api/hooks/use-system-queries";
import type { AppSettings } from "@/lib/api/types";

function SelectedSection({
  sectionId,
  appSettings,
}: {
  sectionId: SettingsSectionId;
  appSettings: AppSettings;
}) {
  switch (sectionId) {
    case "general":
      return <GeneralSection appSettings={appSettings} />;
    case "seed":
      return <SeedSection />;
    case "email":
      return <EmailSection appSettings={appSettings} />;
    case "sms":
      return <SmsSection appSettings={appSettings} />;
    case "payments":
      return <PaymentsSection appSettings={appSettings} />;
    case "opened-events":
      return <OpenedEventsSection appSettings={appSettings} />;
    case "chaos":
      return <ChaosSection appSettings={appSettings} />;
    case "otp":
      return <OtpPatternsSection appSettings={appSettings} />;
    case "connection":
      return <ConnectionSection />;
    case "about":
      return <AboutSection appSettings={appSettings} />;
  }
}

/** Settings: one section at a time, each saving its own changes (PL-05). */
export function SettingsPage() {
  const { section: selectedSectionId = "general" } = useSearch({
    from: "/settings",
  });
  const settingsQuery = useAppSettings();
  const appSettings = settingsQuery.data;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="mx-auto grid w-full max-w-6xl min-w-0 grid-cols-1 gap-4 px-4 py-6 sm:px-6">
        <header className="grid gap-1">
          <h2 className="text-xl font-semibold">Settings</h2>
          <p className="text-sm text-muted-foreground">
            Changes apply at once, without a restart. Export them to the seed
            file to keep them across resets.
          </p>
        </header>
        <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-[12rem_minmax(0,1fr)]">
          <SettingsNav
            selectedSectionId={selectedSectionId}
            isChaosOn={appSettings !== undefined && isChaosActive(appSettings)}
          />
          <div className="min-w-0">
            {settingsQuery.isPending && <Skeleton className="h-72 w-full" />}
            {settingsQuery.isError && (
              <div className="flex flex-col items-start gap-3 rounded-lg border p-6">
                <p className="text-sm text-destructive">
                  Could not load the settings.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void settingsQuery.refetch()}
                >
                  Try again
                </Button>
              </div>
            )}
            {appSettings !== undefined && (
              <SelectedSection
                key={selectedSectionId}
                sectionId={selectedSectionId}
                appSettings={appSettings}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
