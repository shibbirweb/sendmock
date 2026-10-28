import { beforeEach, describe, expect, test } from "vitest";

import {
  markUpdateVersionAnnounced,
  readAnnouncedUpdateVersions,
} from "@/features/updates/announced-update-versions";

describe("markUpdateVersionAnnounced", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test("PL-05.11 announces each new version once", () => {
    expect(markUpdateVersionAnnounced("0.2.0-beta.1")).toBe(true);
    expect(markUpdateVersionAnnounced("0.2.0-beta.1")).toBe(false);
    expect(markUpdateVersionAnnounced("0.2.0-beta.2")).toBe(true);
    expect(readAnnouncedUpdateVersions()).toEqual([
      "0.2.0-beta.2",
      "0.2.0-beta.1",
    ]);
  });

  test("ignores stored values that are not a list of versions", () => {
    localStorage.setItem("sendmock.announced-update-versions", "{oops");

    expect(readAnnouncedUpdateVersions()).toEqual([]);
    expect(markUpdateVersionAnnounced("0.1.1")).toBe(true);
  });
});
