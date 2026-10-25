import { Link } from "@tanstack/react-router";
import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EndpointVariableForm } from "@/features/webhooks/endpoints/sheet/endpoint-variable-form";
import { RequiredVariableRow } from "@/features/webhooks/endpoints/sheet/required-variable-row";
import { useDeleteWebhookVariable } from "@/lib/api/hooks/use-webhook-endpoint-queries";
import {
  useWebhookTemplates,
  useWebhookVariables,
} from "@/lib/api/hooks/use-webhook-queries";
import type { WebhookVariable } from "@/lib/api/types";
import { findRequiredVariableStates } from "@/lib/webhooks/find-required-variables";

/** Which variable the inline form edits: none, a new one, or an existing one. */
type VariableEditState =
  { mode: "closed" } | { mode: "new" } | { mode: "edit"; variableId: string };

function EndpointVariableRow({
  webhookVariable,
  onEdit,
  onDelete,
}: {
  webhookVariable: WebhookVariable;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <li className="flex items-center gap-2 rounded-md border p-2.5 text-sm">
      <code className="truncate font-mono text-xs">{webhookVariable.name}</code>
      <Badge variant="outline" className="capitalize">
        {webhookVariable.kind}
      </Badge>
      <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">
        {webhookVariable.value}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={`Edit ${webhookVariable.name}`}
        onClick={onEdit}
      >
        <PencilIcon />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={`Delete ${webhookVariable.name}`}
        onClick={onDelete}
      >
        <Trash2Icon />
      </Button>
    </li>
  );
}

/** The endpoint's own variables and the ones its template needs (WH-01.6). */
export function EndpointVariablesTab({
  endpointId,
  templateId,
}: {
  endpointId: string;
  templateId: string;
}) {
  const variablesQuery = useWebhookVariables();
  const templatesQuery = useWebhookTemplates();
  const deleteWebhookVariable = useDeleteWebhookVariable();
  const [editState, setEditState] = React.useState<VariableEditState>({
    mode: "closed",
  });

  if (variablesQuery.isPending) {
    return <Skeleton className="h-32 w-full" />;
  }

  const allVariables = variablesQuery.data ?? [];
  const endpointVariables = allVariables.filter(
    (webhookVariable) => webhookVariable.endpoint_id === endpointId,
  );
  const globalVariables = allVariables.filter(
    (webhookVariable) => webhookVariable.scope === "global",
  );
  const requiredVariableNames =
    (templatesQuery.data ?? []).find(
      (webhookTemplate) => webhookTemplate.id === templateId,
    )?.required_variables ?? [];
  const requiredVariableStates = findRequiredVariableStates(
    requiredVariableNames,
    endpointVariables,
    globalVariables,
  );
  const closeForm = () => {
    setEditState({ mode: "closed" });
  };

  return (
    <div className="grid gap-5">
      {requiredVariableStates.length > 0 && (
        <section className="grid gap-2">
          <h3 className="text-sm font-medium">Needed by the template</h3>
          <ul className="grid gap-2">
            {requiredVariableStates.map((requiredVariable) => (
              <RequiredVariableRow
                key={requiredVariable.variableName}
                endpointId={endpointId}
                requiredVariable={requiredVariable}
              />
            ))}
          </ul>
        </section>
      )}
      <section className="grid gap-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-medium">Endpoint variables</h3>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setEditState({ mode: "new" });
            }}
          >
            <PlusIcon />
            Add variable
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Used as {"{{ vars.name }}"} by this endpoint only; they win over
          global variables of the same name. Number, JSON, Dynamic, Random and
          the other kinds are on the{" "}
          <Link
            to="/webhooks/variables"
            search={{ endpoint: endpointId }}
            className="underline underline-offset-4"
          >
            Variables screen
          </Link>
          .
        </p>
        {editState.mode === "new" && (
          <EndpointVariableForm
            endpointId={endpointId}
            editedVariable={null}
            existingVariables={allVariables}
            onDone={closeForm}
          />
        )}
        {endpointVariables.length === 0 && editState.mode !== "new" && (
          <p className="text-sm text-muted-foreground">
            No endpoint variables.
          </p>
        )}
        <ul aria-label="Endpoint variables" className="grid gap-2">
          {endpointVariables.map((webhookVariable) =>
            editState.mode === "edit" &&
            editState.variableId === webhookVariable.id ? (
              <li key={webhookVariable.id}>
                <EndpointVariableForm
                  endpointId={endpointId}
                  editedVariable={webhookVariable}
                  existingVariables={allVariables.filter(
                    (existingVariable) =>
                      existingVariable.id !== webhookVariable.id,
                  )}
                  onDone={closeForm}
                />
              </li>
            ) : (
              <EndpointVariableRow
                key={webhookVariable.id}
                webhookVariable={webhookVariable}
                onEdit={() => {
                  setEditState({
                    mode: "edit",
                    variableId: webhookVariable.id,
                  });
                }}
                onDelete={() => {
                  deleteWebhookVariable.mutate(webhookVariable.id, {
                    onSuccess: () => {
                      toast("Variable deleted");
                    },
                  });
                }}
              />
            ),
          )}
        </ul>
      </section>
    </div>
  );
}
