import * as React from "react";

import { FormField } from "@/components/common/form-field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api/api-client";
import { useCreateProject } from "@/lib/api/hooks/use-project-queries";

/** Lowercase letters, digits and dashes, as the binary accepts them. */
const projectKeyPattern = /^[a-z0-9][a-z0-9-]{0,39}$/;

type FieldErrors = { key?: string; name?: string };

function checkProjectInput(projectKey: string, projectName: string) {
  const fieldErrors: FieldErrors = {};
  if (!projectKeyPattern.test(projectKey)) {
    fieldErrors.key =
      "Use 1 to 40 lowercase letters, digits and dashes, starting with a letter or digit";
  }
  if (projectName.trim() === "") {
    fieldErrors.name = "Enter a name";
  }

  return fieldErrors;
}

/** Asks for a new project's key and name (PL-10.7). Mount it when opening. */
export function NewProjectDialog({ onClose }: { onClose: () => void }) {
  const keyFieldId = React.useId();
  const nameFieldId = React.useId();
  const createProject = useCreateProject();
  const [projectKey, setProjectKey] = React.useState("");
  const [projectName, setProjectName] = React.useState("");
  const [fieldErrors, setFieldErrors] = React.useState<FieldErrors>({});

  function submitProject() {
    const inputErrors = checkProjectInput(projectKey.trim(), projectName);
    setFieldErrors(inputErrors);
    if (Object.keys(inputErrors).length > 0) {
      return;
    }
    createProject.mutate(
      { key: projectKey.trim(), name: projectName.trim() },
      {
        onSuccess: onClose,
        onError: (createError) => {
          const isNameError =
            createError instanceof ApiError && createError.fieldName === "name";
          setFieldErrors(
            isNameError
              ? { name: createError.message }
              : { key: createError.message },
          );
        },
      },
    );
  }

  return (
    <Dialog
      open
      onOpenChange={(isDialogOpen) => {
        if (!isDialogOpen) {
          onClose();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New project</DialogTitle>
          <DialogDescription>
            Apps send to a project by its key, as the SMTP username, the
            X-SendMock-Project header or a /projects/key/ URL prefix.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(submitEvent) => {
            submitEvent.preventDefault();
            submitProject();
          }}
        >
          <FormField
            label="Key"
            fieldId={keyFieldId}
            hint="It never changes, since apps send it."
            errorMessage={fieldErrors.key}
          >
            <Input
              id={keyFieldId}
              value={projectKey}
              placeholder="shop"
              autoComplete="off"
              aria-invalid={fieldErrors.key !== undefined}
              onChange={(changeEvent) => {
                setProjectKey(changeEvent.target.value);
              }}
            />
          </FormField>
          <FormField
            label="Name"
            fieldId={nameFieldId}
            errorMessage={fieldErrors.name}
          >
            <Input
              id={nameFieldId}
              value={projectName}
              placeholder="Shop"
              aria-invalid={fieldErrors.name !== undefined}
              onChange={(changeEvent) => {
                setProjectName(changeEvent.target.value);
              }}
            />
          </FormField>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={createProject.isPending}>
              Create project
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
