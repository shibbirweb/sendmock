import { mockDatabase } from "@/mocks/db/mock-database";
import { defaultProjectKey } from "@/mocks/fixtures/project-fixtures";
import { createErrorResponse } from "@/mocks/handlers/handler-utils";

/**
 * The project a send names in `X-SendMock-Project`, as the binary reads it: `default`
 * without the header, and a 404 for a project that does not exist (PL-10.3).
 */
export function readRequestProject(
  request: Request,
): { projectKey: string } | { refusal: Response } {
  const projectName = request.headers.get("x-sendmock-project")?.trim() ?? "";
  if (projectName === "") {
    return { projectKey: defaultProjectKey };
  }
  const isProject = mockDatabase.projects.some(
    (projectRecord) => projectRecord.key === projectName,
  );

  return isProject
    ? { projectKey: projectName }
    : {
        refusal: createErrorResponse(
          404,
          "project_not_found",
          `No project with key ${projectName}; create it in Settings > Projects first`,
        ),
      };
}
