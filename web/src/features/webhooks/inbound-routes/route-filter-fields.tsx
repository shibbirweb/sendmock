import * as React from "react";

import { FormField } from "@/components/common/form-field";
import { RadioCardGroup } from "@/components/common/radio-card-group";
import { Input } from "@/components/ui/input";
import type { InboundRouteForm } from "@/features/webhooks/inbound-routes/use-inbound-route-form";
import type { InboundRouteFilter } from "@/lib/api/types";
import { toRouteExpression } from "@/lib/inbound-routes/route-expressions";

const filterOptions: {
  value: InboundRouteFilter["kind"];
  label: string;
  description: string;
}[] = [
  {
    value: "match_recipient",
    label: "Match recipient",
    description: "A regex on each recipient address.",
  },
  {
    value: "match_header",
    label: "Match header",
    description: "A regex on a header, e.g. subject.",
  },
  {
    value: "catch_all",
    label: "Catch all",
    description: "Every incoming email.",
  },
];

function buildFilter(
  filterKind: InboundRouteFilter["kind"],
  previousFilter: InboundRouteFilter,
): InboundRouteFilter {
  const pattern =
    previousFilter.kind === "catch_all" ? "" : previousFilter.pattern;
  if (filterKind === "match_header") {
    return { kind: "match_header", header_name: "subject", pattern };
  }

  return filterKind === "match_recipient"
    ? { kind: "match_recipient", pattern }
    : { kind: "catch_all" };
}

/** The filter, built from fields and shown as the Mailgun expression (WH-12.7). */
export function RouteFilterFields({
  routeForm,
}: {
  routeForm: InboundRouteForm;
}) {
  const fieldIdPrefix = React.useId();
  const { routeInput, fieldErrors, changeFilter } = routeForm;
  const routeFilter = routeInput.filter;

  return (
    <div className="grid gap-3">
      <RadioCardGroup<InboundRouteFilter["kind"]>
        legend="Filter"
        className="sm:grid-cols-3"
        options={filterOptions}
        selectedValue={routeFilter.kind}
        onSelect={(filterKind) =>
          changeFilter(buildFilter(filterKind, routeFilter))
        }
      />
      {routeFilter.kind === "match_header" && (
        <FormField
          label="Header name"
          fieldId={`${fieldIdPrefix}-header`}
          errorMessage={fieldErrors.header_name}
        >
          <Input
            id={`${fieldIdPrefix}-header`}
            className="font-mono text-sm"
            value={routeFilter.header_name}
            onChange={(changeEvent) =>
              changeFilter({
                ...routeFilter,
                header_name: changeEvent.target.value,
              })
            }
          />
        </FormField>
      )}
      {routeFilter.kind !== "catch_all" && (
        <FormField
          label="Pattern"
          fieldId={`${fieldIdPrefix}-pattern`}
          hint="A Python-style regex matched from the start; (?P<token>...) captures a group for \g<token> in actions."
          errorMessage={fieldErrors.pattern}
        >
          <Input
            id={`${fieldIdPrefix}-pattern`}
            className="font-mono text-sm"
            placeholder="reply\+(?P<token>.+)@reply\.app\.test"
            value={routeFilter.pattern}
            aria-invalid={fieldErrors.pattern !== undefined}
            onChange={(changeEvent) =>
              changeFilter({
                ...routeFilter,
                pattern: changeEvent.target.value,
              })
            }
          />
        </FormField>
      )}
      <p
        className="rounded-md bg-muted px-2 py-1.5 font-mono text-xs break-all"
        data-testid="route-expression"
      >
        {toRouteExpression(routeFilter)}
      </p>
    </div>
  );
}
