import { CopyButton } from "@/components/common/copy-button";
import { SettingsSectionCard } from "@/features/settings/settings-section-card";

/** One way to send to a project, with the value to copy. */
function ConnectionRow({
  label,
  value,
  copyLabel,
}: {
  label: string;
  value: string;
  copyLabel: string;
}) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-2 rounded-md border px-3 py-2">
      <div className="grid min-w-0 gap-0.5">
        <span className="text-xs text-muted-foreground">{label}</span>
        <code className="truncate font-mono text-sm">{value}</code>
      </div>
      <CopyButton copyText={value} label={copyLabel} />
    </div>
  );
}

/** How an app sends its traffic to a project, shown for one project's key (PL-10.7). */
export function ProjectConnectionCard({ projectKey }: { projectKey: string }) {
  return (
    <SettingsSectionCard
      title={`Send to ${projectKey}`}
      description="Traffic that names no project goes to Default. A project you have not created is refused, so a typo shows at once."
    >
      <div className="grid gap-2">
        <ConnectionRow
          label="SMTP username"
          value={projectKey}
          copyLabel="Copy the SMTP username"
        />
        <ConnectionRow
          label="REST and provider API header"
          value={`X-SendMock-Project: ${projectKey}`}
          copyLabel="Copy the header"
        />
        <ConnectionRow
          label="Provider SDK base URL"
          value={`http://127.0.0.1:8026/projects/${projectKey}`}
          copyLabel="Copy the base URL"
        />
      </div>
    </SettingsSectionCard>
  );
}
