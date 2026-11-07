import { http, HttpResponse } from "msw";

import type { Project, ProjectInput, ProjectUpdate } from "@/lib/api/types";
import { mockDatabase } from "@/mocks/db/mock-database";
import {
  defaultProjectKey,
  type ProjectRecord,
} from "@/mocks/fixtures/project-fixtures";
import {
  applyMockConditions,
  createErrorResponse,
  createNotFoundResponse,
} from "@/mocks/handlers/handler-utils";

const projectKeyPattern = /^[a-z0-9][a-z0-9-]{0,39}$/;

/** Traffic stored before projects existed, or without one, belongs to `default`. */
function isInProject(trafficItem: object, projectKey: string): boolean {
  const trafficProject =
    "project" in trafficItem && typeof trafficItem.project === "string"
      ? trafficItem.project
      : defaultProjectKey;

  return trafficProject === projectKey;
}

function toProject(projectRecord: ProjectRecord): Project {
  const countIn = (trafficItems: object[]) =>
    trafficItems.filter((trafficItem) =>
      isInProject(trafficItem, projectRecord.key),
    ).length;

  return {
    ...projectRecord,
    email_count: countIn(mockDatabase.emails),
    sms_count: countIn(mockDatabase.smsMessages),
    verification_count: countIn(mockDatabase.verifications),
  };
}

function findProject(projectKey: unknown): ProjectRecord | undefined {
  return mockDatabase.projects.find(
    (projectRecord) => projectRecord.key === projectKey,
  );
}

/** The same checks as the binary, with the same messages. */
function readInputError(projectInput: Partial<ProjectInput>): string | null {
  if (
    projectInput.key !== undefined &&
    !projectKeyPattern.test(projectInput.key.trim())
  ) {
    return "Use 1 to 40 lowercase letters, digits and dashes, starting with a letter or digit";
  }
  if (projectInput.name !== undefined && projectInput.name.trim() === "") {
    return "Enter a name";
  }

  return null;
}

export const projectHandlers = [
  http.get("*/api/v1/projects", async () => {
    const conditionResponse = await applyMockConditions();

    return (
      conditionResponse ??
      HttpResponse.json(mockDatabase.projects.map(toProject))
    );
  }),

  http.post("*/api/v1/projects", async ({ request }) => {
    await applyMockConditions();
    const projectInput = (await request.json()) as ProjectInput;
    const inputError = readInputError(projectInput);
    if (inputError !== null) {
      return createErrorResponse(400, "invalid_input", inputError);
    }
    const projectKey = projectInput.key.trim();
    if (findProject(projectKey) !== undefined) {
      return createErrorResponse(
        409,
        "project_exists",
        `A project with key ${projectKey} already exists`,
      );
    }
    const projectRecord: ProjectRecord = {
      key: projectKey,
      name: projectInput.name.trim(),
      created_at: new Date().toISOString(),
    };
    mockDatabase.projects.push(projectRecord);

    return HttpResponse.json(toProject(projectRecord), { status: 201 });
  }),

  http.patch("*/api/v1/projects/:projectKey", async ({ params, request }) => {
    await applyMockConditions();
    const projectRecord = findProject(params.projectKey);
    if (projectRecord === undefined) {
      return createNotFoundResponse("Project");
    }
    const projectUpdate = (await request.json()) as ProjectUpdate;
    const inputError = readInputError(projectUpdate);
    if (inputError !== null) {
      return createErrorResponse(400, "invalid_input", inputError);
    }
    projectRecord.name = projectUpdate.name.trim();

    return HttpResponse.json(toProject(projectRecord));
  }),

  http.delete("*/api/v1/projects/:projectKey", async ({ params }) => {
    await applyMockConditions();
    if (params.projectKey === defaultProjectKey) {
      return createErrorResponse(
        409,
        "default_project",
        "The default project holds traffic sent to no other project and cannot be deleted",
      );
    }
    if (findProject(params.projectKey) === undefined) {
      return createNotFoundResponse("Project");
    }
    const projectKey = String(params.projectKey);
    const isKept = (trafficItem: object) =>
      !isInProject(trafficItem, projectKey);
    mockDatabase.projects = mockDatabase.projects.filter(
      (projectRecord) => projectRecord.key !== projectKey,
    );
    mockDatabase.emails = mockDatabase.emails.filter(isKept);
    mockDatabase.smsMessages = mockDatabase.smsMessages.filter(isKept);
    mockDatabase.verifications = mockDatabase.verifications.filter(isKept);

    return new HttpResponse(null, { status: 204 });
  }),
];
