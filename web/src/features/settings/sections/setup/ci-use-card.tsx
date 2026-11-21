import { WorkflowIcon } from "lucide-react";
import * as React from "react";

import { CopyButton } from "@/components/common/copy-button";
import { FormField } from "@/components/common/form-field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { OperationButton } from "@/features/availability/operation-button";
import { SettingsSectionCard } from "@/features/settings/settings-section-card";
import { useCiInitFiles } from "@/lib/api/hooks/use-ci-queries";
import type { CiSystem } from "@/lib/api/types";

const ciSystemLabels: [CiSystem, string][] = [
  ["github_actions", "GitHub Actions"],
  ["gitlab_ci", "GitLab CI"],
  ["circleci", "CircleCI"],
  ["bitbucket_pipelines", "Bitbucket Pipelines"],
  ["azure_pipelines", "Azure Pipelines"],
  ["jenkins", "Jenkins"],
];

/** The files that run this setup's webhook tests in a pipeline, as `sendmock ci init` writes them (WH-15.7). */
export function CiUseCard() {
  const fieldIdPrefix = React.useId();
  const [ciSystem, setCiSystem] = React.useState<CiSystem>("github_actions");
  const [setupUrl, setSetupUrl] = React.useState("");
  const ciInitFiles = useCiInitFiles();

  return (
    <SettingsSectionCard
      title="Use in CI"
      description="Run your webhook tests in a pipeline: the setup, a starter CI file and the job, filled in for your CI system. sendmock ci init writes the same files."
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="CI system" fieldId={`${fieldIdPrefix}-system`}>
          <Select
            value={ciSystem}
            onValueChange={(selectedSystem) => {
              setCiSystem(selectedSystem as CiSystem);
            }}
          >
            <SelectTrigger id={`${fieldIdPrefix}-system`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ciSystemLabels.map(([systemKey, systemLabel]) => (
                <SelectItem key={systemKey} value={systemKey}>
                  {systemLabel}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <FormField
          label="Setup URL"
          fieldId={`${fieldIdPrefix}-setup-url`}
          hint="Where the pipeline downloads the setup; empty commits the file instead."
        >
          <Input
            id={`${fieldIdPrefix}-setup-url`}
            type="url"
            placeholder="https://raw.githubusercontent.com/acme/shop/main/sendmock.setup.yml"
            value={setupUrl}
            onChange={(changeEvent) => setSetupUrl(changeEvent.target.value)}
          />
        </FormField>
      </div>
      <div>
        <OperationButton
          operationKey="POST /api/v1/ci/init"
          actionName="Show the files"
          type="button"
          variant="outline"
          disabled={ciInitFiles.isPending}
          onClick={() => {
            ciInitFiles.mutate({
              provider: ciSystem,
              setup_url: setupUrl.trim() === "" ? null : setupUrl.trim(),
            });
          }}
        >
          <WorkflowIcon />
          Show the files
        </OperationButton>
      </div>
      {ciInitFiles.data !== undefined && (
        <ul aria-label="CI files" className="grid gap-3">
          {ciInitFiles.data.files.map((ciFile) => (
            <li
              key={ciFile.path}
              className="grid gap-1.5 rounded-md border p-3"
            >
              <div className="flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate font-mono text-sm">
                  {ciFile.path}
                </code>
                <CopyButton
                  copyText={ciFile.content}
                  label={`Copy ${ciFile.path}`}
                  className="size-7"
                />
              </div>
              <p className="text-xs text-muted-foreground">{ciFile.purpose}</p>
              <pre className="max-h-48 overflow-auto rounded bg-muted p-2 font-mono text-xs">
                {ciFile.content}
              </pre>
            </li>
          ))}
        </ul>
      )}
    </SettingsSectionCard>
  );
}
