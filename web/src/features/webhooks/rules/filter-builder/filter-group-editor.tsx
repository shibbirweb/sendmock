import { PlusIcon, Trash2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Toggle } from "@/components/ui/toggle";
import { useFilterBuilderContext } from "@/features/webhooks/rules/filter-builder/filter-builder-context";
import { FilterConditionRow } from "@/features/webhooks/rules/filter-builder/filter-condition-row";
import type { BuilderGroup } from "@/lib/webhooks/rule-filter/builder-tree";
import { cn } from "@/lib/utils";

/** The builder offers one nested level; deeper filters from the API still show. */
const maxGroupDepth = 1;

/** "Match all / any of these", its rows and nested groups (WH-02.5). */
export function FilterGroupEditor({
  builderGroup,
  groupDepth,
}: {
  builderGroup: BuilderGroup;
  groupDepth: number;
}) {
  const { updateNode, removeNode, addCondition, addGroup } =
    useFilterBuilderContext();
  const isRootGroup = groupDepth === 0;
  const groupLabel = isRootGroup ? "Filter" : "Nested group";

  return (
    <div
      role="group"
      aria-label={groupLabel}
      className={cn(
        "grid gap-3",
        !isRootGroup && "rounded-md border border-dashed p-3",
      )}
    >
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Toggle
          size="sm"
          variant="outline"
          aria-label={`Negate ${groupLabel.toLowerCase()}`}
          pressed={builderGroup.isNegated}
          onPressedChange={(isNegated) => {
            updateNode(builderGroup.nodeId, (builderNode) => ({
              ...builderNode,
              isNegated,
            }));
          }}
          className="font-mono text-xs"
        >
          not
        </Toggle>
        <span>Match</span>
        <Select
          value={builderGroup.combinator}
          onValueChange={(nextCombinator) => {
            updateNode(builderGroup.nodeId, (builderNode) =>
              builderNode.nodeKind === "group"
                ? {
                    ...builderNode,
                    combinator: nextCombinator as BuilderGroup["combinator"],
                  }
                : builderNode,
            );
          }}
        >
          <SelectTrigger
            aria-label={`${groupLabel} combinator`}
            size="sm"
            className="w-20"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">all</SelectItem>
            <SelectItem value="any">any</SelectItem>
          </SelectContent>
        </Select>
        <span>of these</span>
        {!isRootGroup && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Remove ${groupLabel.toLowerCase()}`}
            className="ml-auto"
            onClick={() => {
              removeNode(builderGroup.nodeId);
            }}
          >
            <Trash2Icon />
          </Button>
        )}
      </div>
      {builderGroup.children.length === 0 && (
        <p className="text-xs text-muted-foreground">
          {isRootGroup
            ? "No conditions: every selected event fires."
            : "Empty groups are ignored. Add a condition."}
        </p>
      )}
      <ul className="grid gap-3">
        {builderGroup.children.map((childNode, childIndex) =>
          childNode.nodeKind === "condition" ? (
            <FilterConditionRow
              key={childNode.nodeId}
              builderCondition={childNode}
              rowNumber={childIndex + 1}
            />
          ) : (
            <li key={childNode.nodeId}>
              <FilterGroupEditor
                builderGroup={childNode}
                groupDepth={groupDepth + 1}
              />
            </li>
          ),
        )}
      </ul>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            addCondition(builderGroup.nodeId);
          }}
        >
          <PlusIcon />
          Add condition
        </Button>
        {groupDepth < maxGroupDepth && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              addGroup(builderGroup.nodeId);
            }}
          >
            <PlusIcon />
            Add group
          </Button>
        )}
      </div>
    </div>
  );
}
