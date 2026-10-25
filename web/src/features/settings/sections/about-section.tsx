import { RefreshCwIcon } from "lucide-react";
import type * as React from "react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CommunityLinksCard } from "@/features/help/community-links-card";
import { SettingsSectionCard } from "@/features/settings/settings-section-card";
import { SettingsSwitchRow } from "@/features/settings/settings-fields";
import { useSettingsSectionForm } from "@/features/settings/use-settings-section-form";
import {
  useAppInfo,
  useCheckForUpdates,
} from "@/lib/api/hooks/use-system-queries";
import type { AppSettings } from "@/lib/api/types";
import { formatBytes } from "@/lib/format/format-values";

const updateCheckKeys = ["is_update_check_enabled"] as const;

function formatUptime(uptimeSeconds: number): string {
  const uptimeMinutes = Math.floor(uptimeSeconds / 60);

  return uptimeMinutes < 60
    ? `${uptimeMinutes} min`
    : `${Math.floor(uptimeMinutes / 60)} h ${uptimeMinutes % 60} min`;
}

function AboutFact({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="contents">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

function UpdatesCard({ appSettings }: { appSettings: AppSettings }) {
  const sectionForm = useSettingsSectionForm(appSettings, updateCheckKeys);
  const checkForUpdates = useCheckForUpdates();
  const updateCheckResult = checkForUpdates.data;
  // The check uses the saved setting, so it stays off until the switch is saved.
  const canCheck = appSettings.is_update_check_enabled;

  return (
    <SettingsSectionCard
      title="Updates"
      description="Off by default: SendMock never calls out unless you turn this on."
      isDirty={sectionForm.isDirty}
      isSaving={sectionForm.isSaving}
      onSave={sectionForm.saveChanges}
      onDiscard={sectionForm.discardChanges}
    >
      <SettingsSwitchRow
        label="Check GitHub Releases for updates"
        description="Stable installs are offered stable releases; beta installs betas and stables."
        isChecked={sectionForm.draftValues.is_update_check_enabled}
        onCheckedChange={(isEnabled) => {
          sectionForm.updateDraft({ is_update_check_enabled: isEnabled });
        }}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!canCheck || checkForUpdates.isPending}
          onClick={() => checkForUpdates.mutate()}
        >
          <RefreshCwIcon />
          Check for updates
        </Button>
        {updateCheckResult !== undefined && (
          <p aria-live="polite" className="text-sm">
            {updateCheckResult.is_update_available ? (
              <>
                {updateCheckResult.latest_version} is available.{" "}
                <a
                  href={updateCheckResult.release_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary underline underline-offset-2"
                >
                  Release notes
                </a>
              </>
            ) : (
              "You are on the latest version."
            )}
          </p>
        )}
      </div>
    </SettingsSectionCard>
  );
}

/** Version, listeners, database and the opt-in update check (PL-05.6). */
export function AboutSection({ appSettings }: { appSettings: AppSettings }) {
  const appInfoQuery = useAppInfo();
  const appInfo = appInfoQuery.data;

  return (
    <div className="grid gap-4">
      <SettingsSectionCard title="About SendMock">
        {appInfo === undefined ? (
          <Skeleton className="h-32 w-full" />
        ) : (
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-sm">
            <AboutFact label="Version">
              <span className="font-mono">{appInfo.version}</span> (
              {appInfo.channel})
            </AboutFact>
            <AboutFact label="Uptime">
              {formatUptime(appInfo.uptime_seconds)}
            </AboutFact>
            <AboutFact label="SMTP">
              <span className="font-mono">{appInfo.smtp_address}</span>
            </AboutFact>
            <AboutFact label="HTTP and API">
              <span className="font-mono">{appInfo.http_address}</span>
            </AboutFact>
            <AboutFact label="Provider port">
              {appInfo.provider_address === null ? (
                <span className="text-muted-foreground">Off</span>
              ) : (
                <span className="font-mono">{appInfo.provider_address}</span>
              )}
            </AboutFact>
            <AboutFact label="Database">
              <span className="font-mono">{appInfo.database_path}</span>
              <span className="text-muted-foreground">
                {" "}
                ({formatBytes(appInfo.database_size_bytes)})
              </span>
            </AboutFact>
          </dl>
        )}
      </SettingsSectionCard>
      <CommunityLinksCard />
      <UpdatesCard appSettings={appSettings} />
    </div>
  );
}
