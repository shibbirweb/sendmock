import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { ConfirmDeleteDialog } from "@/components/common/confirm-delete-dialog";
import { NamePromptDialog } from "@/components/common/name-prompt-dialog";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { NewProjectDialog } from "@/features/projects/new-project-dialog";
import { SettingsSectionCard } from "@/features/settings/settings-section-card";
import {
  useDeleteProject,
  useRenameProject,
} from "@/lib/api/hooks/use-project-queries";
import type { Project } from "@/lib/api/types";

const defaultProjectKey = "default";

function ProjectRow({
  project,
  onRename,
  onDelete,
}: {
  project: Project;
  onRename: () => void;
  onDelete: () => void;
}) {
  return (
    <TableRow>
      <TableCell className="font-medium">{project.name}</TableCell>
      <TableCell className="font-mono text-xs">{project.key}</TableCell>
      <TableCell className="text-right tabular-nums">
        {project.email_count}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {project.sms_count}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {project.verification_count}
      </TableCell>
      <TableCell className="text-right">
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Rename ${project.name}`}
          onClick={onRename}
        >
          <PencilIcon />
        </Button>
        {project.key !== defaultProjectKey && (
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Delete ${project.name}`}
            onClick={onDelete}
          >
            <Trash2Icon />
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
}

/** Every project with its traffic; new, rename and delete (PL-10.1, PL-10.7). */
export function ProjectsCard({ projects }: { projects: Project[] }) {
  const renameProject = useRenameProject();
  const deleteProject = useDeleteProject();
  const [isCreating, setIsCreating] = React.useState(false);
  const [renamingProject, setRenamingProject] = React.useState<Project | null>(
    null,
  );
  const [deletingProject, setDeletingProject] = React.useState<Project | null>(
    null,
  );

  return (
    <SettingsSectionCard
      title="Projects"
      description="Keep apps' or developers' mail, SMS and codes apart in one SendMock. Settings, providers and webhooks are shared."
    >
      <div className="grid gap-3">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Key</TableHead>
                <TableHead className="text-right">Emails</TableHead>
                <TableHead className="text-right">SMS</TableHead>
                <TableHead className="text-right">Codes</TableHead>
                <TableHead className="sr-only">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.map((project) => (
                <ProjectRow
                  key={project.key}
                  project={project}
                  onRename={() => {
                    setRenamingProject(project);
                  }}
                  onDelete={() => {
                    setDeletingProject(project);
                  }}
                />
              ))}
            </TableBody>
          </Table>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="justify-self-start"
          onClick={() => {
            setIsCreating(true);
          }}
        >
          <PlusIcon />
          New project
        </Button>
      </div>
      {isCreating && (
        <NewProjectDialog
          onClose={() => {
            setIsCreating(false);
          }}
        />
      )}
      {renamingProject !== null && (
        <NamePromptDialog
          title="Rename project"
          description={`The key ${renamingProject.key} stays the same, so apps keep sending to it.`}
          confirmLabel="Rename"
          initialName={renamingProject.name}
          isSubmitting={renameProject.isPending}
          onSubmit={(enteredName) => {
            renameProject.mutate(
              { projectKey: renamingProject.key, name: enteredName },
              {
                onSuccess: () => {
                  setRenamingProject(null);
                },
                onError: () => toast.error("Could not rename the project"),
              },
            );
          }}
          onClose={() => {
            setRenamingProject(null);
          }}
        />
      )}
      <ConfirmDeleteDialog
        itemName={deletingProject?.name ?? null}
        consequence="Its emails, SMS and verifications are deleted with it. Traffic sent to its key afterwards is refused."
        onConfirm={() => {
          if (deletingProject !== null) {
            deleteProject.mutate(deletingProject.key, {
              onError: () => toast.error("Could not delete the project"),
            });
          }
          setDeletingProject(null);
        }}
        onClose={() => {
          setDeletingProject(null);
        }}
      />
    </SettingsSectionCard>
  );
}
