import { describe, expect, test } from "bun:test";

import {
  type BoardItem,
  chooseStatus,
  chooseTarget,
  planBoardItemChanges,
  type ProjectFieldInfo,
  targetOptionColor,
} from "./project-board-plan";
import {
  firstBetaMilestone,
  readReleaseMilestone,
  releaseMilestones,
  waitingOnOthersMilestone,
} from "./release-milestones";

const projectFields: ProjectFieldInfo[] = [
  {
    id: "status-field",
    name: "Status",
    options: [
      { id: "later", name: "Later" },
      { id: "in-progress", name: "In progress" },
      { id: "done", name: "Done" },
    ],
  },
  {
    id: "target-field",
    name: "Target",
    options: releaseMilestones.map((milestone) => ({
      id: `target-${milestone}`,
      name: milestone,
    })),
  },
];

function buildBoardItem(boardItemChanges: Partial<BoardItem>): BoardItem {
  return {
    itemId: "item-1",
    issueNumber: 221,
    isClosed: false,
    milestoneTitle: "1.2.0",
    status: "Later",
    target: "1.2.0",
    ...boardItemChanges,
  };
}

describe("a feature's release milestone", () => {
  test("comes from the start of its acceptance intro", () => {
    expect(readReleaseMilestone("1.3.0 (A18), planned 2026-11-16", false)).toBe(
      "1.3.0",
    );
    expect(
      readReleaseMilestone("0.1.0-beta.1 (planned as After 1.0), built", true),
    ).toBe(firstBetaMilestone);
    expect(
      readReleaseMilestone("Waiting on others (left over from 1.0.0)", false),
    ).toBe(waitingOnOthersMilestone);
  });

  test("is the first beta for done 1.0 work and 1.0.0 for unfinished 1.0 work", () => {
    expect(readReleaseMilestone("Phase 3 W2", true)).toBe(firstBetaMilestone);
    expect(readReleaseMilestone("Phase 5", false)).toBe("1.0.0");
  });

  test("refuses an intro that names no release or a release with no milestone", () => {
    expect(() => readReleaseMilestone("After 1.0, planned", false)).toThrow(
      "names no release",
    );
    expect(() => readReleaseMilestone("3.0.0 (A40)", false)).toThrow(
      "has no milestone",
    );
  });
});

describe("the project board", () => {
  test("Target is the release milestone, and empty outside one", () => {
    expect(chooseTarget(buildBoardItem({ milestoneTitle: "1.1.0" }))).toBe(
      "1.1.0",
    );
    expect(chooseTarget(buildBoardItem({ milestoneTitle: null }))).toBeNull();
  });

  test("a closed issue is Done whatever the board said", () => {
    expect(
      chooseStatus(buildBoardItem({ isClosed: true, status: "In progress" }), undefined),
    ).toBe("Done");
  });

  test("an open feature issue takes its feature's status", () => {
    expect(chooseStatus(buildBoardItem({ status: "Later" }), "In progress")).toBe(
      "In progress",
    );
  });

  test("another open issue keeps In progress or Later, and is not shown as Done", () => {
    expect(chooseStatus(buildBoardItem({ status: "In progress" }), undefined)).toBe(
      "In progress",
    );
    expect(chooseStatus(buildBoardItem({ status: "Done" }), undefined)).toBe(
      "In progress",
    );
    expect(chooseStatus(buildBoardItem({ status: null }), undefined)).toBe(
      "Later",
    );
  });

  test("plans only the values that differ", () => {
    expect(
      planBoardItemChanges(
        [
          buildBoardItem({}),
          buildBoardItem({
            itemId: "item-2",
            isClosed: true,
            status: "In progress",
            milestoneTitle: "1.0.0",
            target: "1.0",
          }),
          buildBoardItem({
            itemId: "item-3",
            milestoneTitle: null,
            target: "1.2.0",
          }),
        ],
        new Map(),
        projectFields,
      ),
    ).toEqual([
      { itemId: "item-2", fieldId: "status-field", optionId: "done" },
      { itemId: "item-2", fieldId: "target-field", optionId: "target-1.0.0" },
      { itemId: "item-3", fieldId: "target-field", optionId: null },
    ]);
  });

  test("released milestones are green, planned ones blue and the waiting one yellow", () => {
    expect(targetOptionColor("1.1.0")).toBe("GREEN");
    expect(targetOptionColor("1.4.0")).toBe("GREEN");
    expect(targetOptionColor("2.0.0")).toBe("BLUE");
    expect(targetOptionColor(waitingOnOthersMilestone)).toBe("YELLOW");
  });
});
