import { ExternalLinkIcon, LockIcon } from "lucide-react";
import type * as React from "react";

import { HttpHeadersList } from "@/components/common/http-headers-list";
import type { WebhookTemplateDetail } from "@/lib/api/types";
import { isSecretVariableName } from "@/lib/webhooks/validate-webhook-variable";

function TemplateFact({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="contents">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

/** Description, events, variables, request shape and the provider doc link (WH-08.4). */
export function TemplateFacts({
  templateDetail,
}: {
  templateDetail: WebhookTemplateDetail;
}) {
  return (
    <div className="grid min-w-0 gap-4">
      <p className="text-sm">{templateDetail.description}</p>
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
        <TemplateFact label="Events">
          <span aria-label="Template events" className="flex flex-wrap gap-1">
            {templateDetail.events.length === 0
              ? "Any"
              : templateDetail.events.map((eventType) => (
                  <span
                    key={eventType}
                    className="rounded border px-1 font-mono text-[11px]"
                  >
                    {eventType}
                  </span>
                ))}
          </span>
        </TemplateFact>
        <TemplateFact label="Variables">
          {templateDetail.required_variables.length === 0 ? (
            "None needed"
          ) : (
            <span
              aria-label="Required variables"
              className="flex flex-wrap gap-1.5"
            >
              {templateDetail.required_variables.map((variableName) => (
                <span
                  key={variableName}
                  className="inline-flex items-center gap-1 font-mono text-xs"
                >
                  {isSecretVariableName(variableName) && (
                    <LockIcon aria-label="secret" className="size-3" />
                  )}
                  {variableName}
                </span>
              ))}
            </span>
          )}
        </TemplateFact>
        <TemplateFact label="Request">
          <span className="font-mono text-xs">
            {templateDetail.method} · {templateDetail.content_type}
          </span>
        </TemplateFact>
        <TemplateFact label="Revision">{templateDetail.revision}</TemplateFact>
        {templateDetail.used_by_endpoint_count > 0 && (
          <TemplateFact label="Used by">
            {templateDetail.used_by_endpoint_count} endpoint
            {templateDetail.used_by_endpoint_count === 1 ? "" : "s"}
          </TemplateFact>
        )}
        {templateDetail.doc_url !== null && (
          <TemplateFact label="Provider docs">
            <a
              href={templateDetail.doc_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 underline underline-offset-4"
            >
              Webhook reference
              <ExternalLinkIcon aria-hidden="true" className="size-3" />
            </a>
            {templateDetail.verified_on !== null && (
              <span className="block text-xs text-muted-foreground">
                Verified against the docs as of {templateDetail.verified_on}
              </span>
            )}
          </TemplateFact>
        )}
      </dl>
      {Object.keys(templateDetail.header_templates).length > 0 && (
        <HttpHeadersList
          title="Header templates"
          headers={templateDetail.header_templates}
        />
      )}
      <section aria-label="Body template" className="grid gap-1.5">
        <h4 className="text-xs font-medium text-muted-foreground">
          Body template
        </h4>
        <pre className="max-h-64 overflow-auto rounded-md border bg-muted/30 p-3 font-mono text-xs leading-relaxed break-all whitespace-pre-wrap">
          {templateDetail.body_template}
        </pre>
      </section>
    </div>
  );
}
