import { ExternalLinkIcon } from "lucide-react";

import { CopyButton } from "@/components/common/copy-button";
import type {
  AvailableRelease,
  InstallMethod,
  UpdateCheckResult,
} from "@/lib/api/types";
import { formatDateTime } from "@/lib/format/format-values";

const installMethodLabels: Record<InstallMethod, string> = {
  homebrew: "Homebrew",
  scoop: "Scoop",
  docker: "Docker",
  install_script: "the install script",
  npm: "npm",
  unknown: "an unknown method",
};

function UpgradeInstructions({
  availableRelease,
  installMethod,
}: {
  availableRelease: AvailableRelease;
  installMethod: InstallMethod;
}) {
  if (availableRelease.upgrade_command === null) {
    return (
      <p className="text-sm text-muted-foreground">
        SendMock does not know how it was installed. Download the new version
        from the release page.
      </p>
    );
  }

  return (
    <div className="grid gap-1.5">
      <p className="text-sm text-muted-foreground">
        Installed with {installMethodLabels[installMethod]}; upgrade with:
      </p>
      <div className="flex items-center gap-2 rounded-md border bg-muted/30 py-1 pr-1 pl-3">
        <code className="min-w-0 flex-1 font-mono text-xs break-all">
          {availableRelease.upgrade_command}
        </code>
        <CopyButton
          copyText={availableRelease.upgrade_command}
          label="Copy the upgrade command"
        />
      </div>
    </div>
  );
}

function AvailableReleaseDetails({
  availableRelease,
  installMethod,
}: {
  availableRelease: AvailableRelease;
  installMethod: InstallMethod;
}) {
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-medium">
          SendMock {availableRelease.version} is available
        </p>
        <span className="text-xs text-muted-foreground">
          Released {formatDateTime(availableRelease.published_at)}
        </span>
      </div>
      <div className="grid gap-1.5">
        <h4 className="text-sm font-medium">Release notes</h4>
        <pre className="max-h-48 overflow-y-auto rounded-md border bg-muted/30 p-3 font-sans text-xs leading-relaxed whitespace-pre-wrap">
          {availableRelease.release_notes_markdown}
        </pre>
      </div>
      <UpgradeInstructions
        availableRelease={availableRelease}
        installMethod={installMethod}
      />
      <a
        href={availableRelease.release_url}
        target="_blank"
        rel="noreferrer"
        className="inline-flex w-fit items-center gap-1 text-sm text-primary underline underline-offset-2"
      >
        Release page
        <ExternalLinkIcon aria-hidden="true" className="size-3.5" />
      </a>
    </div>
  );
}

function describeNoUpdate(updateCheckResult: UpdateCheckResult): string {
  if (!updateCheckResult.is_channel_checked) {
    return `${updateCheckResult.channel === "edge" ? "Edge" : "Development"} builds are not offered updates; install a stable or beta release to get them.`;
  }

  return `You are on the latest ${updateCheckResult.channel} version (${updateCheckResult.current_version}).`;
}

/** What an update check found (PL-05.11, PL-05.12). */
export function UpdateCheckResultView({
  updateCheckResult,
}: {
  updateCheckResult: UpdateCheckResult;
}) {
  const checkedAtText = `Checked ${formatDateTime(updateCheckResult.checked_at)}${updateCheckResult.is_from_cache ? " (kept for 24 hours)" : ""}`;

  return (
    <div aria-live="polite" className="grid gap-2 rounded-lg border p-4">
      {updateCheckResult.available_release === null ? (
        <p className="text-sm">{describeNoUpdate(updateCheckResult)}</p>
      ) : (
        <AvailableReleaseDetails
          availableRelease={updateCheckResult.available_release}
          installMethod={updateCheckResult.install_method}
        />
      )}
      <p className="text-xs text-muted-foreground">{checkedAtText}</p>
    </div>
  );
}
