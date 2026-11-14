import { describe, expect, test } from "bun:test";

import {
  findCoverageFailures,
  summariseCoverageByCrate,
} from "./rust-coverage";

function coveredFile(filename: string, count: number, covered: number) {
  return { filename, summary: { lines: { count, covered } } };
}

describe("summariseCoverageByCrate", () => {
  test("adds up the files of each crate", () => {
    const crateCoverages = summariseCoverageByCrate({
      data: [
        {
          files: [
            coveredFile("/repo/crates/sendmock-core/src/clock.rs", 10, 9),
            coveredFile(
              "/repo/crates/sendmock-core/src/id_generator.rs",
              10,
              10,
            ),
            coveredFile("C:\\repo\\crates\\sendmock-ops\\src\\lib.rs", 4, 2),
          ],
        },
      ],
    });

    expect(crateCoverages).toEqual([
      { crateName: "sendmock-core", lineCount: 20, coveredLineCount: 19 },
      { crateName: "sendmock-ops", lineCount: 4, coveredLineCount: 2 },
    ]);
  });

  test("reads an empty report as no crates", () => {
    expect(summariseCoverageByCrate({})).toEqual([]);
  });
});

describe("findCoverageFailures", () => {
  test("passes at 80% overall with the strict crates at 90%", () => {
    const failures = findCoverageFailures([
      { crateName: "sendmock-api", lineCount: 100, coveredLineCount: 70 },
      { crateName: "sendmock-ops", lineCount: 100, coveredLineCount: 90 },
    ]);

    expect(failures).toEqual([]);
  });

  test("fails when overall coverage is below 80%", () => {
    const failures = findCoverageFailures([
      { crateName: "sendmock-api", lineCount: 100, coveredLineCount: 79 },
    ]);

    expect(failures).toEqual(["Overall line coverage is 79.0%, below 80%"]);
  });

  test("fails when an operations or domain crate is below 90%", () => {
    const failures = findCoverageFailures([
      { crateName: "sendmock-core", lineCount: 100, coveredLineCount: 100 },
      { crateName: "sendmock-sms", lineCount: 100, coveredLineCount: 89 },
    ]);

    expect(failures).toEqual([
      "sendmock-sms line coverage is 89.0%, below 90%",
    ]);
  });
});
