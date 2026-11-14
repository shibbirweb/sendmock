import { QueryErrorState } from "@/components/common/query-error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { ProjectConnectionCard } from "@/features/projects/project-connection-card";
import { ProjectsCard } from "@/features/projects/projects-card";
import { useProjects } from "@/lib/api/hooks/use-project-queries";

/** Settings > Projects: the projects and how apps send to one (PL-10.7). */
export function ProjectsSection() {
  const projectsQuery = useProjects();
  if (projectsQuery.isPending) {
    return <Skeleton className="h-48 w-full" />;
  }
  if (projectsQuery.isError) {
    return (
      <QueryErrorState
        message="Could not load the projects."
        onRetry={() => void projectsQuery.refetch()}
      />
    );
  }
  const exampleProjectKey =
    projectsQuery.data.find((project) => project.key !== "default")?.key ??
    "shop";

  return (
    <div className="grid gap-4">
      <ProjectsCard projects={projectsQuery.data} />
      <ProjectConnectionCard projectKey={exampleProjectKey} />
    </div>
  );
}
