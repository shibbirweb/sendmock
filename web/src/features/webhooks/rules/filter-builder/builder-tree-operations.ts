import type {
  BuilderGroup,
  BuilderNode,
} from "@/lib/webhooks/rule-filter/builder-tree";

/** The tree with one node replaced by `updateNode(node)`. */
export function updateBuilderNode(
  rootGroup: BuilderGroup,
  nodeId: number,
  updateNode: (builderNode: BuilderNode) => BuilderNode,
): BuilderGroup {
  const visitNode = (builderNode: BuilderNode): BuilderNode => {
    if (builderNode.nodeId === nodeId) {
      return updateNode(builderNode);
    }
    if (builderNode.nodeKind === "group") {
      return { ...builderNode, children: builderNode.children.map(visitNode) };
    }

    return builderNode;
  };

  return visitNode(rootGroup) as BuilderGroup;
}

/** The tree without one node (the root itself is never removed). */
export function removeBuilderNode(
  rootGroup: BuilderGroup,
  nodeId: number,
): BuilderGroup {
  const visitGroup = (builderGroup: BuilderGroup): BuilderGroup => ({
    ...builderGroup,
    children: builderGroup.children
      .filter((childNode) => childNode.nodeId !== nodeId)
      .map((childNode) =>
        childNode.nodeKind === "group" ? visitGroup(childNode) : childNode,
      ),
  });

  return visitGroup(rootGroup);
}

/** The tree with a node added at the end of a group. */
export function appendBuilderNode(
  rootGroup: BuilderGroup,
  groupId: number,
  addedNode: BuilderNode,
): BuilderGroup {
  return updateBuilderNode(rootGroup, groupId, (builderNode) =>
    builderNode.nodeKind === "group"
      ? { ...builderNode, children: [...builderNode.children, addedNode] }
      : builderNode,
  );
}

/** The highest node id in the tree, so new ids never collide. */
export function findHighestNodeId(builderNode: BuilderNode): number {
  if (builderNode.nodeKind === "condition") {
    return builderNode.nodeId;
  }

  return Math.max(
    builderNode.nodeId,
    ...builderNode.children.map(findHighestNodeId),
  );
}
