import { DownloadIcon } from "lucide-react";
import * as React from "react";

import { CopyButton } from "@/components/common/copy-button";
import { FormField } from "@/components/common/form-field";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SettingsSectionCard } from "@/features/settings/settings-section-card";
import { buildApiUrl } from "@/lib/api/api-client";
import { useAiAgents } from "@/lib/api/hooks/use-automation-queries";
import type { AiAgentTarget } from "@/lib/api/types";

function CodeBlock({ title, code }: { title: string; code: string }) {
  return (
    <section aria-label={title} className="grid gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-medium">{title}</h4>
        <CopyButton copyText={code} label={`Copy ${title.toLowerCase()}`} />
      </div>
      <pre className="overflow-x-auto rounded-md border bg-muted/30 p-3 font-mono text-xs leading-relaxed">
        {code}
      </pre>
    </section>
  );
}

/** How to connect an AI agent: install command, MCP configuration, skill (`GET /ai/agents`). */
export function AiAgentsCard() {
  const fieldId = React.useId();
  const aiAgentsQuery = useAiAgents();
  const [selectedTarget, setSelectedTarget] =
    React.useState<AiAgentTarget>("claude-code");
  const aiAgents = aiAgentsQuery.data ?? [];
  const selectedAgent =
    aiAgents.find((aiAgent) => aiAgent.target === selectedTarget) ??
    aiAgents[0];

  return (
    <SettingsSectionCard
      title="AI agents"
      description="Let Claude Code, Codex, Cursor, Gemini CLI or VS Code drive SendMock through MCP and the agent skill."
    >
      <FormField label="AI agent" fieldId={fieldId}>
        <Select
          value={selectedTarget}
          onValueChange={(nextTarget) =>
            setSelectedTarget(nextTarget as AiAgentTarget)
          }
        >
          <SelectTrigger id={fieldId} className="w-full sm:w-72">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {aiAgents.map((aiAgent) => (
              <SelectItem key={aiAgent.target} value={aiAgent.target}>
                {aiAgent.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormField>
      {selectedAgent !== undefined && (
        <div className="grid gap-4">
          <CodeBlock
            title="Install command"
            code={selectedAgent.install_command}
          />
          <CodeBlock
            title="MCP configuration"
            code={selectedAgent.mcp_config}
          />
          <p className="text-xs text-muted-foreground">
            The install command writes the configuration to{" "}
            <code className="font-mono">{selectedAgent.mcp_config_path}</code>{" "}
            and the skill to{" "}
            <code className="font-mono">{selectedAgent.instructions_path}</code>
            , after showing what it will change.
          </p>
        </div>
      )}
      <div>
        <Button variant="outline" size="sm" asChild>
          <a href={buildApiUrl("/ai/skill")} download="SKILL.md">
            <DownloadIcon />
            Download the skill
          </a>
        </Button>
      </div>
    </SettingsSectionCard>
  );
}
