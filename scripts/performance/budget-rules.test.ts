import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

import {
  type Budget,
  evaluateBudgets,
  findBudgetFileProblems,
  formatBudgetTable,
} from "./budget-rules";

const budgets = JSON.parse(
  readFileSync("scripts/performance/budgets.json", "utf8"),
) as Record<string, Budget>;

const withinBudget = {
  binary_size_bytes: 15 * 1024 * 1024,
  cold_start_ms: 80,
  idle_memory_bytes: 12 * 1024 * 1024,
  smtp_ingest_messages_per_second: 2400,
};

describe("performance budgets", () => {
  test("DS-07.1 the budgets are the plan's: 20 MB, 200 ms, 30 MB and 500 messages a second", () => {
    expect(budgets.binary_size_bytes?.limit).toBe(20 * 1024 * 1024);
    expect(budgets.cold_start_ms?.limit).toBe(200);
    expect(budgets.idle_memory_bytes?.limit).toBe(30 * 1024 * 1024);
    expect(budgets.smtp_ingest_messages_per_second).toMatchObject({
      kind: "minimum",
      limit: 500,
    });
    expect(findBudgetFileProblems(budgets)).toEqual([]);
  });

  test("DS-07.2 a measurement over a maximum or under a minimum fails its budget", () => {
    const results = evaluateBudgets(budgets, {
      ...withinBudget,
      cold_start_ms: 250,
      smtp_ingest_messages_per_second: 300,
    });

    expect(
      results
        .filter((result) => !result.isWithinBudget)
        .map((result) => result.metric),
    ).toEqual(["cold_start_ms", "smtp_ingest_messages_per_second"]);
    expect(formatBudgetTable(results)).toContain("OVER BUDGET");
  });

  test("DS-07.2 an override with a reason moves the limit, and shows in the table", () => {
    const overriddenBudgets: Record<string, Budget> = {
      ...budgets,
      cold_start_ms: {
        label: "Cold start to listening",
        unit: "ms",
        kind: "maximum",
        limit: 200,
        override: {
          limit: 300,
          reason: "the TLS certificate is generated on first start",
        },
      },
    };

    const results = evaluateBudgets(overriddenBudgets, {
      ...withinBudget,
      cold_start_ms: 250,
    });

    expect(results.every((result) => result.isWithinBudget)).toBe(true);
    expect(formatBudgetTable(results)).toContain(
      "override: the TLS certificate is generated on first start",
    );
  });

  test("DS-07.2 an override without a reason is refused", () => {
    expect(
      findBudgetFileProblems({
        cold_start_ms: {
          label: "Cold start",
          unit: "ms",
          kind: "maximum",
          limit: 200,
          override: { limit: 900, reason: " " },
        },
      }),
    ).toEqual(["cold_start_ms: an override needs a reason"]);
  });

  test("a missing measurement is an error, not a pass", () => {
    expect(() => evaluateBudgets(budgets, { cold_start_ms: 10 })).toThrow(
      "no measurement for binary_size_bytes",
    );
  });
});
