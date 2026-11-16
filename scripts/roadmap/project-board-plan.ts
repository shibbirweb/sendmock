// Works out which project board values must change so each item matches its issue; the
// sync script (sync-project-board.ts) applies them.
import type { FeatureIssue } from "./build-feature-issues";
import {
  releasedMilestones,
  releaseMilestones,
  waitingOnOthersMilestone,
} from "./release-milestones";

export type ProjectFieldInfo = {
  id: string;
  name: string;
  options: { id: string; name: string }[] | null;
};

export type BoardItem = {
  itemId: string;
  issueNumber: number;
  isClosed: boolean;
  milestoneTitle: string | null;
  status: string | null;
  target: string | null;
};

export type BoardFieldChange = {
  itemId: string;
  fieldId: string;
  /** null clears the value. */
  optionId: string | null;
};

/** Released milestones green, planned ones blue, the waiting one yellow. */
export function targetOptionColor(milestone: string): string {
  if (milestone === waitingOnOthersMilestone) {
    return "YELLOW";
  }
  return releasedMilestones.has(milestone) ? "GREEN" : "BLUE";
}

/** Target is the release milestone; an issue in no release milestone has none. */
export function chooseTarget(boardItem: BoardItem): string | null {
  return boardItem.milestoneTitle !== null &&
    releaseMilestones.includes(boardItem.milestoneTitle)
    ? boardItem.milestoneTitle
    : null;
}

/**
 * Done for a closed issue; a feature's own status for an open feature issue; otherwise an
 * open issue keeps In progress or Later, and one shown as Done or with none is In progress
 * (Later when it has no status yet and nothing was started).
 */
export function chooseStatus(
  boardItem: BoardItem,
  featureStatus: FeatureIssue["status"] | undefined,
): string {
  if (boardItem.isClosed) {
    return "Done";
  }
  if (featureStatus !== undefined) {
    return featureStatus === "Done" ? "In progress" : featureStatus;
  }
  if (boardItem.status === "In progress" || boardItem.status === "Later") {
    return boardItem.status;
  }
  return boardItem.status === "Done" ? "In progress" : "Later";
}

function findOptionId(
  projectFields: ProjectFieldInfo[],
  fieldName: string,
  optionName: string,
): { fieldId: string; optionId: string } {
  const field = projectFields.find(
    (projectField) => projectField.name === fieldName,
  );
  const optionId = field?.options?.find(
    (option) => option.name === optionName,
  )?.id;
  if (field === undefined || optionId === undefined) {
    throw new Error(`The project's ${fieldName} field has no ${optionName}.`);
  }
  return { fieldId: field.id, optionId };
}

export function planBoardItemChanges(
  boardItems: BoardItem[],
  featureStatuses: Map<number, FeatureIssue["status"]>,
  projectFields: ProjectFieldInfo[],
): BoardFieldChange[] {
  const targetFieldId = projectFields.find(
    (projectField) => projectField.name === "Target",
  )?.id;
  if (targetFieldId === undefined) {
    throw new Error("The project has no Target field.");
  }
  return boardItems.flatMap((boardItem) => {
    const fieldChanges: BoardFieldChange[] = [];
    const wantedStatus = chooseStatus(
      boardItem,
      featureStatuses.get(boardItem.issueNumber),
    );
    if (boardItem.status !== wantedStatus) {
      fieldChanges.push({
        itemId: boardItem.itemId,
        ...findOptionId(projectFields, "Status", wantedStatus),
      });
    }
    const wantedTarget = chooseTarget(boardItem);
    if (boardItem.target !== wantedTarget) {
      fieldChanges.push(
        wantedTarget === null
          ? { itemId: boardItem.itemId, fieldId: targetFieldId, optionId: null }
          : {
              itemId: boardItem.itemId,
              ...findOptionId(projectFields, "Target", wantedTarget),
            },
      );
    }
    return fieldChanges;
  });
}
