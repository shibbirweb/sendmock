import { describe, expect, test } from "vitest";

import {
  appendBuilderNode,
  findHighestNodeId,
  removeBuilderNode,
  updateBuilderNode,
} from "@/features/webhooks/rules/filter-builder/builder-tree-operations";
import {
  createEmptyCondition,
  createEmptyGroup,
  type BuilderGroup,
} from "@/lib/webhooks/rule-filter/builder-tree";

function buildTree(): BuilderGroup {
  return {
    ...createEmptyGroup(1),
    children: [
      createEmptyCondition(2, "subject"),
      { ...createEmptyGroup(3), children: [createEmptyCondition(4, "to")] },
    ],
  };
}

describe("builder tree operations", () => {
  test("updates a nested node without touching the others", () => {
    const updatedTree = updateBuilderNode(buildTree(), 4, (builderNode) =>
      builderNode.nodeKind === "condition"
        ? { ...builderNode, value: "x" }
        : builderNode,
    );

    const nestedGroup = updatedTree.children[1];
    expect(
      nestedGroup?.nodeKind === "group" && nestedGroup.children[0],
    ).toMatchObject({
      value: "x",
    });
    expect(updatedTree.children[0]).toMatchObject({ value: "" });
  });

  test("removes a node at any depth", () => {
    const treeWithoutCondition = removeBuilderNode(buildTree(), 4);
    const nestedGroup = treeWithoutCondition.children[1];

    expect(nestedGroup?.nodeKind === "group" && nestedGroup.children).toEqual(
      [],
    );
    expect(removeBuilderNode(buildTree(), 3).children).toHaveLength(1);
  });

  test("appends to a group and finds the highest id", () => {
    const grownTree = appendBuilderNode(
      buildTree(),
      3,
      createEmptyCondition(9, "body"),
    );

    expect(findHighestNodeId(grownTree)).toBe(9);
  });
});
