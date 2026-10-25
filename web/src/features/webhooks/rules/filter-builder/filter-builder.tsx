import * as React from "react";

import {
  appendBuilderNode,
  findHighestNodeId,
  removeBuilderNode,
  updateBuilderNode,
} from "@/features/webhooks/rules/filter-builder/builder-tree-operations";
import {
  FilterBuilderContext,
  type FilterBuilderContextValue,
} from "@/features/webhooks/rules/filter-builder/filter-builder-context";
import { FilterGroupEditor } from "@/features/webhooks/rules/filter-builder/filter-group-editor";
import {
  type BuilderGroup,
  createEmptyCondition,
  createEmptyGroup,
} from "@/lib/webhooks/rule-filter/builder-tree";
import type { RuleFieldDefinition } from "@/lib/webhooks/rule-filter/rule-fields";

/**
 * Visual filter builder: groups of field / operator / value rows. Controlled:
 * the parent keeps the tree and converts it with `toRuleFilter` (WH-02.5).
 */
export function FilterBuilder({
  rootGroup,
  fieldDefinitions,
  isShowingErrors,
  onChange,
}: {
  rootGroup: BuilderGroup;
  fieldDefinitions: RuleFieldDefinition[];
  isShowingErrors: boolean;
  onChange: (nextRootGroup: BuilderGroup) => void;
}) {
  const contextValue = React.useMemo<FilterBuilderContextValue>(() => {
    const generateNodeId = () => findHighestNodeId(rootGroup) + 1;
    const defaultFieldKey = fieldDefinitions[0]?.fieldKey ?? "subject";

    return {
      fieldDefinitions,
      isShowingErrors,
      updateNode: (nodeId, updateNode) => {
        onChange(updateBuilderNode(rootGroup, nodeId, updateNode));
      },
      removeNode: (nodeId) => {
        onChange(removeBuilderNode(rootGroup, nodeId));
      },
      addCondition: (groupId) => {
        onChange(
          appendBuilderNode(
            rootGroup,
            groupId,
            createEmptyCondition(generateNodeId(), defaultFieldKey),
          ),
        );
      },
      addGroup: (groupId) => {
        const groupNodeId = generateNodeId();
        const nestedGroup: BuilderGroup = {
          ...createEmptyGroup(groupNodeId),
          combinator: "any",
          children: [createEmptyCondition(groupNodeId + 1, defaultFieldKey)],
        };
        onChange(appendBuilderNode(rootGroup, groupId, nestedGroup));
      },
    };
  }, [rootGroup, fieldDefinitions, isShowingErrors, onChange]);

  return (
    <FilterBuilderContext.Provider value={contextValue}>
      <FilterGroupEditor builderGroup={rootGroup} groupDepth={0} />
    </FilterBuilderContext.Provider>
  );
}
