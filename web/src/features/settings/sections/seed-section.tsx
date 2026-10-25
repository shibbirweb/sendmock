import { DownloadIcon, FileCode2Icon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SeedApplyCard } from "@/features/settings/sections/seed-apply-card";
import { SettingsSectionCard } from "@/features/settings/settings-section-card";
import { useExportSeed, useSeedStatus } from "@/lib/api/hooks/use-seed-queries";
import { formatDateTime } from "@/lib/format/format-values";

function downloadTextFile(fileText: string, fileName: string) {
  const fileUrl = URL.createObjectURL(
    new Blob([fileText], { type: "application/toml" }),
  );
  const downloadLink = document.createElement("a");
  downloadLink.href = fileUrl;
  downloadLink.download = fileName;
  downloadLink.click();
  URL.revokeObjectURL(fileUrl);
}

function SeedStatusCard() {
  const seedStatusQuery = useSeedStatus();
  const exportSeed = useExportSeed();
  const seedStatus = seedStatusQuery.data;

  return (
    <SettingsSectionCard
      title="Seed file"
      description="The configuration SendMock starts from and resets to, kept in your repository."
    >
      {seedStatus === undefined ? (
        <Skeleton className="h-16 w-full" />
      ) : (
        <div className="grid gap-3 text-sm">
          <p className="flex flex-wrap items-center gap-2">
            <FileCode2Icon className="size-4 text-muted-foreground" />
            <span className="font-mono">
              {seedStatus.source_path ?? "No seed file"}
            </span>
            {seedStatus.applied_at !== null && (
              <span className="text-muted-foreground">
                applied {formatDateTime(seedStatus.applied_at)}
              </span>
            )}
          </p>
          {seedStatus.changed_items.length === 0 ? (
            <p className="text-muted-foreground">
              The configuration matches the seed file.
            </p>
          ) : (
            <div className="grid gap-1.5 rounded-md bg-muted/50 p-3">
              <p>
                {seedStatus.changed_items.length} item
                {seedStatus.changed_items.length === 1 ? " is" : "s are"} not in
                the seed file yet. Export to keep{" "}
                {seedStatus.changed_items.length === 1 ? "it" : "them"} after a
                reset.
              </p>
              <ul
                aria-label="Changed since the seed"
                className="flex flex-wrap gap-1.5"
              >
                {seedStatus.changed_items.map((changedItem) => (
                  <li
                    key={`${changedItem.item_kind}-${changedItem.item_name}`}
                    className="rounded-full border bg-background px-2 py-0.5 text-xs"
                  >
                    {changedItem.item_kind}: {changedItem.item_name}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      <div>
        <Button
          type="button"
          disabled={exportSeed.isPending}
          onClick={() => {
            exportSeed.mutate(undefined, {
              onSuccess: (seedToml) => {
                downloadTextFile(seedToml, "sendmock.seed.toml");
                toast("Seed file exported", {
                  description: "Secrets are written as ${ENV_VAR} references.",
                });
              },
            });
          }}
        >
          <DownloadIcon />
          Export sendmock.seed.toml
        </Button>
      </div>
    </SettingsSectionCard>
  );
}

/** Seed status, export, and validate-then-apply (PL-04.6). */
export function SeedSection() {
  return (
    <div className="grid gap-4">
      <SeedStatusCard />
      <SeedApplyCard />
    </div>
  );
}
