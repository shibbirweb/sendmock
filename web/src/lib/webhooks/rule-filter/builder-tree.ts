import type {
  RuleCondition,
  RuleFilter,
  RuleFilterOperator,
} from "@/lib/api/types";
import { headerFieldPrefix } from "@/lib/webhooks/rule-filter/rule-fields";

export type BuilderCondition = {
  nodeKind: "condition";
  nodeId: number;
  isNegated: boolean;
  /** A field key; `header:` when the header name is kept apart. */
  fieldKey: string;
  headerName: string;
  operator: RuleFilterOperator;
  value: string;
};

export type BuilderGroup = {
  nodeKind: "group";
  nodeId: number;
  isNegated: boolean;
  combinator: "all" | "any";
  children: BuilderNode[];
};

export type BuilderNode = BuilderCondition | BuilderGroup;

/** Gives each node a stable id for React keys and edits. */
export function createNodeIdGenerator(firstNodeId = 1) {
  let nextNodeId = firstNodeId;

  return () => {
    const nodeId = nextNodeId;
    nextNodeId += 1;

    return nodeId;
  };
}

export function createEmptyCondition(
  nodeId: number,
  fieldKey: string,
): BuilderCondition {
  return {
    nodeKind: "condition",
    nodeId,
    isNegated: false,
    fieldKey,
    headerName: "",
    operator: "contains",
    value: "",
  };
}

export function createEmptyGroup(nodeId: number): BuilderGroup {
  return {
    nodeKind: "group",
    nodeId,
    isNegated: false,
    combinator: "all",
    children: [],
  };
}

function toBuilderCondition(
  condition: RuleCondition,
  nodeId: number,
  isNegated: boolean,
): BuilderCondition {
  const isHeaderField = condition.field.startsWith(headerFieldPrefix);

  return {
    nodeKind: "condition",
    nodeId,
    isNegated,
    fieldKey: isHeaderField ? headerFieldPrefix : condition.field,
    headerName: isHeaderField
      ? condition.field.slice(headerFieldPrefix.length)
      : "",
    operator: condition.operator,
    value: condition.value,
  };
}

function toBuilderNode(
  ruleFilter: RuleFilter,
  generateNodeId: () => number,
  isNegated = false,
): BuilderNode {
  if ("not" in ruleFilter) {
    return toBuilderNode(ruleFilter.not, generateNodeId, !isNegated);
  }
  if ("all" in ruleFilter || "any" in ruleFilter) {
    const combinator = "all" in ruleFilter ? "all" : "any";
    const childFilters = "all" in ruleFilter ? ruleFilter.all : ruleFilter.any;

    return {
      nodeKind: "group",
      nodeId: generateNodeId(),
      isNegated,
      combinator,
      children: childFilters.map((childFilter) =>
        toBuilderNode(childFilter, generateNodeId),
      ),
    };
  }

  return toBuilderCondition(ruleFilter, generateNodeId(), isNegated);
}

/** The API filter as a builder tree whose root is always a group (WH-02.5). */
export function toBuilderTree(
  ruleFilter: RuleFilter | null,
  generateNodeId: () => number,
): BuilderGroup {
  if (ruleFilter === null) {
    return createEmptyGroup(generateNodeId());
  }

  const builderNode = toBuilderNode(ruleFilter, generateNodeId);
  if (builderNode.nodeKind === "group") {
    return builderNode;
  }

  return { ...createEmptyGroup(generateNodeId()), children: [builderNode] };
}

function wrapNegation(ruleFilter: RuleFilter, isNegated: boolean): RuleFilter {
  return isNegated ? { not: ruleFilter } : ruleFilter;
}

function toRuleFilterNode(builderNode: BuilderNode): RuleFilter {
  if (builderNode.nodeKind === "condition") {
    const field =
      builderNode.fieldKey === headerFieldPrefix
        ? `${headerFieldPrefix}${builderNode.headerName.trim()}`
        : builderNode.fieldKey;

    return wrapNegation(
      { field, operator: builderNode.operator, value: builderNode.value },
      builderNode.isNegated,
    );
  }

  const childFilters = builderNode.children.map(toRuleFilterNode);
  const groupFilter: RuleFilter =
    builderNode.combinator === "all"
      ? { all: childFilters }
      : { any: childFilters };

  return wrapNegation(groupFilter, builderNode.isNegated);
}

/** The builder tree as an API filter; an empty root means no filter. */
export function toRuleFilter(rootGroup: BuilderGroup): RuleFilter | null {
  if (rootGroup.children.length === 0) {
    return null;
  }

  return toRuleFilterNode(rootGroup);
}
