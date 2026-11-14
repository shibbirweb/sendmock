import { FolderKanbanIcon } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useSelectedProjectKey,
  useSelectProject,
} from "@/hooks/use-selected-project";
import { useProjects } from "@/lib/api/hooks/use-project-queries";

const everyProjectValue = "__every_project__";

/**
 * Picks which project's mail, SMS and codes the screens show (PL-10.7). Hidden until a
 * second project exists, so a single-project instance looks as it did.
 */
export function ProjectSwitcher() {
  const projectsQuery = useProjects();
  const selectedProjectKey = useSelectedProjectKey();
  const selectProject = useSelectProject();
  const projects = projectsQuery.data ?? [];
  if (projects.length < 2) {
    return null;
  }

  return (
    <Select
      value={selectedProjectKey ?? everyProjectValue}
      onValueChange={(chosenValue) => {
        selectProject(
          chosenValue === everyProjectValue ? undefined : chosenValue,
        );
      }}
    >
      <SelectTrigger
        size="sm"
        aria-label="Project"
        className="w-40 max-w-[40vw]"
      >
        <FolderKanbanIcon />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={everyProjectValue}>All projects</SelectItem>
        {projects.map((project) => (
          <SelectItem key={project.key} value={project.key}>
            {project.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
