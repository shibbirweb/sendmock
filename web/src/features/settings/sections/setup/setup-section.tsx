import { FeatureAvailabilityGate } from "@/features/availability/feature-availability-gate";
import { SeedStatusCard } from "@/features/settings/sections/setup/seed-status-card";
import { SetupExportCard } from "@/features/settings/sections/setup/setup-export-card";
import { SetupImportCard } from "@/features/settings/sections/setup/setup-import-card";

/** Settings > Setup: the seed's status, and a setup's export and import (PL-04.6, PL-18). */
export function SetupSection() {
  return (
    <div className="grid gap-4">
      <FeatureAvailabilityGate
        operationKey="GET /api/v1/seed/status"
        featureName="Seed status and export"
        description="What the seed file set up, what changed since, and an export of the current setup."
      >
        <SeedStatusCard />
      </FeatureAvailabilityGate>
      <SetupExportCard />
      <SetupImportCard />
    </div>
  );
}
