import { useNavigate, useSearch } from "@tanstack/react-router";

/** The project the user picked in the top bar, kept in the URL as `?project=` (PL-10.7). */
export function useSelectedProjectKey(): string | undefined {
  const { project } = useSearch({ strict: false });

  return project;
}

/** Picks a project, or every project with `undefined`, on the current screen. */
export function useSelectProject(): (projectKey: string | undefined) => void {
  const navigate = useNavigate();

  return (projectKey) => {
    void navigate({
      to: ".",
      search: (currentSearch) => ({ ...currentSearch, project: projectKey }),
      replace: true,
    });
  };
}
