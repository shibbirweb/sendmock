import * as React from "react";

import type { BuilderNode } from "@/lib/webhooks/rule-filter/builder-tree";
import type { RuleFieldDefinition } from "@/lib/webhooks/rule-filter/rule-fields";

export type FilterBuilderContextValue = {
  fieldDefinitions: RuleFieldDefinition[];
  isShowingErrors: boolean;
  updateNode: (
    nodeId: number,
    updateNode: (builderNode: BuilderNode) => BuilderNode,
  ) => void;
  removeNode: (nodeId: number) => void;
  addCondition: (groupId: number) => void;
  addGroup: (groupId: number) => void;
};

export const FilterBuilderContext =
  React.createContext<FilterBuilderContextValue | null>(null);

/** Shared state for the rows and groups of one filter builder. */
export function useFilterBuilderContext(): FilterBuilderContextValue {
  const contextValue = React.useContext(FilterBuilderContext);
  if (contextValue === null) {
    throw new Error("Filter builder parts must be inside <FilterBuilder>.");
  }

  return contextValue;
}
