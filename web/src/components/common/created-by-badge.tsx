import { Badge } from "@/components/ui/badge";
import type { CreatedBy } from "@/lib/api/types";

const badgeLabels: Partial<Record<CreatedBy, string>> = {
  cli: "CLI",
  mcp: "MCP",
};

const badgeHints: Partial<Record<CreatedBy, string>> = {
  cli: "Created with the sendmock CLI",
  mcp: "Created by an AI agent through MCP",
};

/** Marks what the CLI or an AI agent made, so it can be told from the user's own (AI-05.4). */
export function CreatedByBadge({ createdBy }: { createdBy: CreatedBy }) {
  const badgeLabel = badgeLabels[createdBy];
  if (badgeLabel === undefined) {
    return null;
  }

  return (
    <Badge
      variant="outline"
      className="ml-1.5 align-middle text-[10px]"
      title={badgeHints[createdBy]}
    >
      {badgeLabel}
    </Badge>
  );
}
