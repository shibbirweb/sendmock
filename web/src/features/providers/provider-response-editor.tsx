import { PlusIcon, Trash2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ProviderResponseTemplate } from "@/lib/api/types";

/** One answer: its status, header templates and body template. */
export function ProviderResponseEditor({
  responseLabel,
  responseTemplate,
  onChange,
}: {
  /** "Success response" or "Missing field response", for labels. */
  responseLabel: string;
  responseTemplate: ProviderResponseTemplate;
  onChange: (nextResponse: ProviderResponseTemplate) => void;
}) {
  const { headers } = responseTemplate;
  const changeHeader = (
    headerIndex: number,
    changedFields: Partial<ProviderResponseTemplate["headers"][number]>,
  ) => {
    onChange({
      ...responseTemplate,
      headers: headers.map((header, candidateIndex) =>
        candidateIndex === headerIndex
          ? { ...header, ...changedFields }
          : header,
      ),
    });
  };

  return (
    <div className="grid gap-2">
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Status</span>
        <Input
          aria-label={`${responseLabel} status`}
          type="number"
          className="h-7 w-24 text-xs"
          value={responseTemplate.status}
          onChange={(changeEvent) =>
            onChange({
              ...responseTemplate,
              status: Number(changeEvent.target.value),
            })
          }
        />
      </div>
      {headers.map((header, headerIndex) => (
        <div
          key={headerIndex}
          className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_auto] gap-2"
        >
          <Input
            aria-label={`${responseLabel} header ${headerIndex + 1} name`}
            className="h-7 font-mono text-xs"
            value={header.name}
            onChange={(changeEvent) =>
              changeHeader(headerIndex, { name: changeEvent.target.value })
            }
          />
          <Input
            aria-label={`${responseLabel} header ${headerIndex + 1} value`}
            className="h-7 font-mono text-xs"
            value={header.template}
            onChange={(changeEvent) =>
              changeHeader(headerIndex, { template: changeEvent.target.value })
            }
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Remove ${responseLabel} header ${headerIndex + 1}`}
            onClick={() =>
              onChange({
                ...responseTemplate,
                headers: headers.filter(
                  (_header, candidateIndex) => candidateIndex !== headerIndex,
                ),
              })
            }
          >
            <Trash2Icon />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="justify-self-start"
        onClick={() =>
          onChange({
            ...responseTemplate,
            headers: [...headers, { name: "", template: "" }],
          })
        }
      >
        <PlusIcon />
        Add header
      </Button>
      <Textarea
        aria-label={`${responseLabel} body`}
        className="min-h-24 font-mono text-xs"
        value={responseTemplate.body}
        onChange={(changeEvent) =>
          onChange({ ...responseTemplate, body: changeEvent.target.value })
        }
      />
    </div>
  );
}
