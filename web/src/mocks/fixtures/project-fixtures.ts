import type { ProjectInput } from "@/lib/api/types";

/** A project as the mock keeps it; the traffic counts are read when it is listed. */
export type ProjectRecord = ProjectInput & { created_at: string };

export const defaultProjectKey = "default";

/** Only `default`, as on a fresh instance: the project switcher stays hidden. */
export function buildProjectFixtures(): ProjectRecord[] {
  return [
    {
      key: defaultProjectKey,
      name: "Default",
      created_at: "1970-01-01T00:00:00Z",
    },
  ];
}
