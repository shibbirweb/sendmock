import { PlusIcon, Trash2Icon } from "lucide-react";
import * as React from "react";

import { FormField } from "@/components/common/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OptionSelect } from "@/features/providers/option-select";
import { errorKinds } from "@/features/providers/provider-options";
import { ProviderResponseEditor } from "@/features/providers/provider-response-editor";
import type { MessageProviderForm } from "@/features/providers/use-message-provider-form";

/** The message id, the success response and one response per error kind. */
export function ProviderResponsesTab({
  providerForm,
}: {
  providerForm: MessageProviderForm;
}) {
  const fieldIdPrefix = React.useId();
  const { providerInput, updateInput } = providerForm;
  const errorResponses = providerInput.error_responses;
  const unusedKind = errorKinds.find(
    ({ kind }) =>
      !errorResponses.some((errorResponse) => errorResponse.kind === kind),
  );

  return (
    <div className="grid content-start gap-5">
      <p className="text-xs text-muted-foreground">
        Templates read <code className="font-mono">request</code>,{" "}
        <code className="font-mono">message</code>,{" "}
        <code className="font-mono">error</code> and{" "}
        <code className="font-mono">credentials</code>; the Preview tab lists
        every value with an example.
      </p>
      <FormField
        label="Message id"
        fieldId={`${fieldIdPrefix}-message-id`}
        hint="The provider's id for each message, e.g. SM{{ random_hex(32) }}."
      >
        <Input
          id={`${fieldIdPrefix}-message-id`}
          className="font-mono text-xs"
          value={providerInput.message_id_template}
          onChange={(changeEvent) =>
            updateInput({ message_id_template: changeEvent.target.value })
          }
        />
      </FormField>
      <section className="grid gap-2 rounded-lg border p-3">
        <h3 className="text-sm font-medium">Success response</h3>
        <ProviderResponseEditor
          responseLabel="Success response"
          responseTemplate={providerInput.success_response}
          onChange={(successResponse) =>
            updateInput({ success_response: successResponse })
          }
        />
      </section>
      {errorResponses.map((errorResponse, responseIndex) => (
        <section
          key={responseIndex}
          className="grid gap-2 rounded-lg border p-3"
        >
          <div className="flex items-center gap-2">
            <OptionSelect
              ariaLabel={`Error response ${responseIndex + 1} kind`}
              className="w-44"
              value={errorResponse.kind}
              options={errorKinds.map(({ kind, label }) => ({
                value: kind,
                label: `${label} response`,
              }))}
              onChange={(kind) =>
                updateInput({
                  error_responses: errorResponses.map((candidate, index) =>
                    index === responseIndex
                      ? { ...candidate, kind }
                      : candidate,
                  ),
                })
              }
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="ms-auto"
              aria-label={`Remove error response ${responseIndex + 1}`}
              onClick={() =>
                updateInput({
                  error_responses: errorResponses.filter(
                    (_candidate, index) => index !== responseIndex,
                  ),
                })
              }
            >
              <Trash2Icon />
            </Button>
          </div>
          <ProviderResponseEditor
            responseLabel={`Error response ${responseIndex + 1}`}
            responseTemplate={errorResponse}
            onChange={(nextResponse) =>
              updateInput({
                error_responses: errorResponses.map((candidate, index) =>
                  index === responseIndex
                    ? { ...nextResponse, kind: candidate.kind }
                    : candidate,
                ),
              })
            }
          />
        </section>
      ))}
      {unusedKind !== undefined && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="justify-self-start"
          onClick={() =>
            updateInput({
              error_responses: [
                ...errorResponses,
                {
                  kind: unusedKind.kind,
                  status: 400,
                  headers: [],
                  body: '{"error": "{{ error.reason }}"}',
                },
              ],
            })
          }
        >
          <PlusIcon />
          Add an error response
        </Button>
      )}
    </div>
  );
}
