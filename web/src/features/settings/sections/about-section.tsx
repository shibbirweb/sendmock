import type * as React from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { CommunityLinksCard } from "@/features/help/community-links-card";
import { SettingsSectionCard } from "@/features/settings/settings-section-card";
import { UpdatesCard } from "@/features/updates/updates-card";
import { useAppInfo } from "@/lib/api/hooks/use-system-queries";
import type { AppSettings } from "@/lib/api/types";
import { formatBytes } from "@/lib/format/format-values";

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
