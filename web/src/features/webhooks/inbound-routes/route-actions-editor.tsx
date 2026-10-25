import { ArrowDownIcon, ArrowUpIcon, PlusIcon, Trash2Icon } from "lucide-react";

import { FormFieldError } from "@/components/common/form-field-error";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import type { InboundRouteForm } from "@/features/webhooks/inbound-routes/use-inbound-route-form";
import type { InboundRouteAction } from "@/lib/api/types";
import { toActionExpression } from "@/lib/inbound-routes/route-expressions";
import { moveListItem } from "@/lib/move-list-item";

const actionChoices: {
  label: string;
  description: string;
  buildAction: () => InboundRouteAction;
}[] = [
  {
    label: "Forward to URL",
    description: "POST the parsed email in Mailgun's fields.",
    buildAction: () => ({
      kind: "forward_url",
      url: "http://localhost:8000/webhooks/mail",
    }),
  },
  {
    label: "Forward to email",
    description: "Send it on, only to addresses on the release allowlist.",
    buildAction: () => ({ kind: "forward_email", address: "" }),
  },
  {
    label: "Store and notify",
    description: "Keep it and POST a notification with message-url.",
    buildAction: () => ({ kind: "store", notify_url: "" }),
  },
  {
    label: "Stop",
    description: "Do not run lower-priority routes.",
    buildAction: () => ({ kind: "stop" }),
  },
];

const actionLabels: Record<InboundRouteAction["kind"], string> = {
  forward_url: "Forward to URL",
  forward_email: "Forward to email",
  store: "Store and notify",
  stop: "Stop",
};

function ActionValueInput({
  routeAction,
  ariaLabel,
  onChange,
}: {
  routeAction: InboundRouteAction;
  ariaLabel: string;
  onChange: (changedAction: InboundRouteAction) => void;
}) {
  if (routeAction.kind === "stop") {
    return null;
  }
  const value =
    routeAction.kind === "forward_url"
      ? routeAction.url
      : routeAction.kind === "forward_email"
        ? routeAction.address
        : (routeAction.notify_url ?? "");

  return (
    <Input
      aria-label={ariaLabel}
      className="font-mono text-xs"
      placeholder={
        routeAction.kind === "forward_email"
          ? "dev@company.com"
          : "http://localhost:8000/webhooks/mail"
      }
      value={value}
      onChange={(changeEvent) => {
        const nextValue = changeEvent.target.value;
        onChange(
          routeAction.kind === "forward_url"
            ? { ...routeAction, url: nextValue }
            : routeAction.kind === "forward_email"
              ? { ...routeAction, address: nextValue }
              : { ...routeAction, notify_url: nextValue },
        );
      }}
    />
  );
}

/** The actions in order, each shown as its Mailgun action (WH-12.7). */
export function RouteActionsEditor({
  routeForm,
}: {
  routeForm: InboundRouteForm;
}) {
  const { routeInput, fieldErrors, changeActions } = routeForm;
  const routeActions = routeInput.actions;

  return (
    <section aria-label="Actions" className="grid gap-2">
      <div className="flex items-center justify-between gap-2">
        <div className="grid gap-0.5">
          <h3 className="text-sm font-medium">Actions</h3>
          <p className="text-xs text-muted-foreground">
            Run in this order; URLs and addresses can use captured groups such
            as <code className="font-mono">{"\\g<token>"}</code>.
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" size="sm">
              <PlusIcon />
              Add action
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72">
            {actionChoices.map((actionChoice) => (
              <DropdownMenuItem
                key={actionChoice.label}
                className="grid gap-0.5"
                onSelect={() =>
                  changeActions([...routeActions, actionChoice.buildAction()])
                }
              >
                <span>{actionChoice.label}</span>
                <span className="text-xs text-muted-foreground">
                  {actionChoice.description}
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <FormFieldError errorMessage={fieldErrors.actions} />
      <ol className="grid gap-2">
        {routeActions.map((routeAction, actionIndex) => {
          const actionName = `Action ${actionIndex + 1}: ${actionLabels[routeAction.kind]}`;

          return (
            <li
              key={actionIndex}
              aria-label={actionName}
              className="grid gap-1.5 rounded-md border p-2"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{actionName}</span>
                <span className="flex gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Move ${actionName} up`}
                    disabled={actionIndex === 0}
                    onClick={() =>
                      changeActions(
                        moveListItem(
                          routeActions,
                          actionIndex,
                          actionIndex - 1,
                        ),
                      )
                    }
                  >
                    <ArrowUpIcon />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Move ${actionName} down`}
                    disabled={actionIndex === routeActions.length - 1}
                    onClick={() =>
                      changeActions(
                        moveListItem(
                          routeActions,
                          actionIndex,
                          actionIndex + 1,
                        ),
                      )
                    }
                  >
                    <ArrowDownIcon />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove ${actionName}`}
                    onClick={() =>
                      changeActions(
                        routeActions.filter(
                          (_routeAction, candidateIndex) =>
                            candidateIndex !== actionIndex,
                        ),
                      )
                    }
                  >
                    <Trash2Icon />
                  </Button>
                </span>
              </div>
              <ActionValueInput
                routeAction={routeAction}
                ariaLabel={`${actionName} target`}
                onChange={(changedAction) =>
                  changeActions(
                    routeActions.map((candidateAction, candidateIndex) =>
                      candidateIndex === actionIndex
                        ? changedAction
                        : candidateAction,
                    ),
                  )
                }
              />
              <code className="font-mono text-xs break-all text-muted-foreground">
                {toActionExpression(routeAction)}
              </code>
              <FormFieldError
                errorMessage={fieldErrors[`actions.${actionIndex}`]}
              />
            </li>
          );
        })}
      </ol>
    </section>
  );
}
