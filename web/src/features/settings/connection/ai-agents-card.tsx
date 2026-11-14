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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { SettingsSectionCard } from "@/features/settings/settings-section-card";
import { buildApiUrl } from "@/lib/api/api-client";
import { useAiAgents } from "@/lib/api/hooks/use-automation-queries";
import type { AiAgentSetup, AiAgentTarget } from "@/lib/api/types";

type McpLaunch = "installed" | "npx";

const mcpLaunchLabels: Record<McpLaunch, string> = {
  installed: "Installed",
  npx: "npx (no install)",
};

/** The command and configuration for how SendMock runs, and where the configuration goes. */
function readLaunchSetup(agentSetup: AiAgentSetup, mcpLaunch: McpLaunch) {
  const isNpx = mcpLaunch === "npx";
  const mcpConfig = isNpx ? agentSetup.npx_mcp_config : agentSetup.mcp_config;
  return {
    installCommand: isNpx
      ? agentSetup.npx_install_command
      : agentSetup.install_command,
    mcpConfig,
    // Claude Code's configuration is a command, so it is also its own place.
    mcpConfigPath:
      agentSetup.mcp_config_path === agentSetup.mcp_config
        ? mcpConfig
        : agentSetup.mcp_config_path,
  };
}

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
  const [mcpLaunch, setMcpLaunch] = React.useState<McpLaunch>("installed");
  const aiAgents = aiAgentsQuery.data ?? [];
  const selectedAgent =
    aiAgents.find((aiAgent) => aiAgent.target === selectedTarget) ??
    aiAgents[0];
  const launchSetup =
    selectedAgent === undefined
      ? undefined
      : readLaunchSetup(selectedAgent, mcpLaunch);

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
      <div className="grid gap-1.5">
        <span className="text-sm font-medium">SendMock runs as</span>
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          aria-label="SendMock runs as"
          value={mcpLaunch}
          onValueChange={(selectedLaunch) => {
            if (selectedLaunch) {
              setMcpLaunch(selectedLaunch as McpLaunch);
            }
          }}
          className="w-full sm:w-72"
        >
          {(Object.keys(mcpLaunchLabels) as McpLaunch[]).map((launchOption) => (
            <ToggleGroupItem
              key={launchOption}
              value={launchOption}
              className="flex-1 text-xs"
            >
              {mcpLaunchLabels[launchOption]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        {mcpLaunch === "npx" && (
          <p className="text-xs text-muted-foreground">
            Nothing to install: the agent starts SendMock with{" "}
            <code className="font-mono">npx -y sendmock mcp</code>, which needs
            Node.js. On Windows, if the agent cannot start npx, use{" "}
            <code className="font-mono">cmd /c npx -y sendmock mcp</code>.
          </p>
        )}
      </div>
      {selectedAgent !== undefined && launchSetup !== undefined && (
        <div className="grid gap-4">
          <CodeBlock
            title="Install command"
            code={launchSetup.installCommand}
          />
          <CodeBlock title="MCP configuration" code={launchSetup.mcpConfig} />
          <p className="text-xs text-muted-foreground">
            The install command writes the configuration to{" "}
            <code className="font-mono">{launchSetup.mcpConfigPath}</code> and
            the skill to{" "}
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
