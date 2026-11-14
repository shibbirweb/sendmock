import { describe, expect, test } from "bun:test";

import { readCriterionReferences } from "./acceptance";
import {
  listFeaturesNotAccepted,
  listUntickedCriterionIds,
  listWorkflowSettings,
  parseRunbookSteps,
  readRunbookSteps,
} from "./release/release-readiness-sources";

describe("the 1.0 release runbook", () => {
  test("names every secret and variable a workflow reads in its secrets step", () => {
    const secretsStep = readRunbookSteps().find((step) => step.title.startsWith("Set the secrets"));
    const unnamedSettings = listWorkflowSettings()
      .map((setting) => setting.name)
      .filter((settingName) => !secretsStep?.body.includes(`\`${settingName}\``));

    expect(unnamedSettings).toEqual([]);
  });

  test("names a step for every unticked criterion of a started feature that no test proves", () => {
    const provenCriterionIds = readRunbookSteps().flatMap((step) => step.provenCriterionIds);
    const criterionReferences = readCriterionReferences();
    // A feature not started yet is proven by the tests it is built with, not by an owner step;
    // release-readiness.ts still lists it among the features not accepted.
    const notStartedFeatureIds = listFeaturesNotAccepted()
      .filter((feature) => feature.status === "Not started")
      .map((feature) => feature.featureId);
    const criteriaWithoutProof = listUntickedCriterionIds().filter(
      (criterionId) =>
        !provenCriterionIds.includes(criterionId) &&
        !criterionReferences.has(criterionId) &&
        !notStartedFeatureIds.some((featureId) => criterionId.startsWith(`${featureId}.`)),
    );

    expect(criteriaWithoutProof).toEqual([]);
  });

  test("leaves out the criteria of features planned after 1.0", () => {
    expect(listUntickedCriterionIds().some((criterionId) => criterionId.startsWith("EM-20."))).toBe(
      false,
    );
  });

  test("numbers its steps in order from 1", () => {
    const stepNumbers = readRunbookSteps().map((step) => step.stepNumber);

    expect(stepNumbers).toEqual(stepNumbers.map((_, stepIndex) => stepIndex + 1));
  });

  test("reads a step's title, body and the criteria on its Proves line", () => {
    const runbookText = [
      "# Runbook",
      "",
      "Intro.",
      "",
      "## 1. Merge it",
      "",
      "Run this. AI-01.1 here is only text.",
      "",
      "Proves: DS-02.5, WS-03.7",
      "",
      "## 2. Wait",
      "",
      "Nothing to prove.",
    ].join("\n");

    expect(
      parseRunbookSteps(runbookText).map(({ stepNumber, title, provenCriterionIds }) => ({
        stepNumber,
        title,
        provenCriterionIds,
      })),
    ).toEqual([
      { stepNumber: 1, title: "Merge it", provenCriterionIds: ["DS-02.5", "WS-03.7"] },
      { stepNumber: 2, title: "Wait", provenCriterionIds: [] },
    ]);
  });
});
