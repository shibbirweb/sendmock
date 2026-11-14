import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { requestApi } from "@/lib/api/api-client";
import { queryKeys } from "@/lib/api/query-keys";
import type { Project, ProjectInput } from "@/lib/api/types";

export function useProjects() {
  return useQuery({
    queryKey: queryKeys.projects,
    queryFn: ({ signal }) =>
      requestApi<Project[]>("/projects", { abortSignal: signal }),
  });
}

/** A change to projects also changes which traffic exists, so the lists reload too. */
function useProjectMutation<MutationInput>(
  mutationRequest: (mutationInput: MutationInput) => Promise<unknown>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: mutationRequest,
    onSuccess: () => {
      for (const queryKey of [
        queryKeys.projects,
        queryKeys.emails.all,
        queryKeys.sms.all,
        queryKeys.verify.all,
      ]) {
        void queryClient.invalidateQueries({ queryKey });
      }
    },
  });
}

export function useCreateProject() {
  return useProjectMutation((projectInput: ProjectInput) =>
    requestApi<Project>("/projects", {
      method: "POST",
      requestBody: projectInput,
    }),
  );
}

export function useRenameProject() {
  return useProjectMutation(
    ({ projectKey, name }: { projectKey: string; name: string }) =>
      requestApi<Project>(`/projects/${projectKey}`, {
        method: "PATCH",
        requestBody: { name },
      }),
  );
}

export function useDeleteProject() {
  return useProjectMutation((projectKey: string) =>
    requestApi(`/projects/${projectKey}`, { method: "DELETE" }),
  );
}
