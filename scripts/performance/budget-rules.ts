/**
 * The performance budgets (DS-07, docs/plan/09-distribution.md#performance-budget-checked-in-ci-on-linux-x64)
 * and how a measurement is held to them. A budget can be overridden only in budgets.json, with a
 * higher (or, for a minimum, lower) limit and a reason, so every override shows in review.
 */

export type BudgetKind = "maximum" | "minimum";

export type Budget = {
  label: string;
  unit: string;
  kind: BudgetKind;
  limit: number;
  override?: { limit: number; reason: string };
};

export type BudgetResult = {
  metric: string;
  label: string;
  unit: string;
  measured: number;
  limit: number;
  isWithinBudget: boolean;
  overrideReason: string | null;
};

/** Problems in budgets.json itself, such as an override without a reason. */
export function findBudgetFileProblems(
  budgets: Record<string, Budget>,
): string[] {
  return Object.entries(budgets).flatMap(([metric, budget]) => {
    const problems: string[] = [];
    if (!Number.isFinite(budget.limit) || budget.limit <= 0) {
      problems.push(`${metric}: the limit must be a positive number`);
    }
    if (budget.override !== undefined && budget.override.reason.trim() === "") {
      problems.push(`${metric}: an override needs a reason`);
    }
    return problems;
  });
}

export function evaluateBudgets(
  budgets: Record<string, Budget>,
  measurements: Record<string, number>,
): BudgetResult[] {
  return Object.entries(budgets).map(([metric, budget]) => {
    const measured = measurements[metric];
    if (measured === undefined) {
      throw new Error(`no measurement for ${metric}`);
    }
    const limit = budget.override?.limit ?? budget.limit;
    const isWithinBudget =
      budget.kind === "maximum" ? measured <= limit : measured >= limit;
    return {
      metric,
      label: budget.label,
      unit: budget.unit,
      measured,
      limit,
      isWithinBudget,
      overrideReason: budget.override?.reason ?? null,
    };
  });
}

function formatValue(value: number, unit: string): string {
  if (unit === "bytes") {
    return `${(value / 1024 / 1024).toFixed(1)} MB`;
  }
  return `${Math.round(value)} ${unit}`;
}

/** A Markdown table for the job summary. */
export function formatBudgetTable(results: BudgetResult[]): string {
  const rows = results.map((result) => {
    const comparison =
      result.unit === "messages/s"
        ? `at least ${formatValue(result.limit, result.unit)}`
        : `under ${formatValue(result.limit, result.unit)}`;
    const verdict = result.isWithinBudget ? "within budget" : "OVER BUDGET";
    const note =
      result.overrideReason === null
        ? ""
        : ` (override: ${result.overrideReason})`;
    return `| ${result.label} | ${formatValue(result.measured, result.unit)} | ${comparison}${note} | ${verdict} |`;
  });
  return [
    "| Metric | Measured | Budget | Result |",
    "|---|---|---|---|",
    ...rows,
  ].join("\n");
}
