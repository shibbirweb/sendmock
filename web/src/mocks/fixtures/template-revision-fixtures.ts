import type { TemplateRevision } from "@/lib/api/types";
import { minutesAgo } from "@/mocks/fixtures/fixture-helpers";
import { readTemplateDefinition } from "@/mocks/fixtures/template-definitions";

/**
 * Earlier versions of the seeded custom template (now at revision 3), so
 * History has something to diff and restore (WH-09.5).
 */
export function buildTemplateRevisionFixtures(): Map<
  string,
  TemplateRevision[]
> {
  const currentDefinition = readTemplateDefinition("custom.tenant_inbound");
  const templateMetadata = {
    name: "Postmark inbound with tenant header",
    description: "Clone of Postmark inbound that adds an X-Tenant header.",
    events: ["email.received" as const],
    required_variables: ["tenant_id"],
  };
  const requestShape = {
    method: currentDefinition.method,
    content_type: currentDefinition.content_type,
  };

  return new Map([
    [
      "custom.tenant_inbound",
      [
        {
          revision: 3,
          saved_at: minutesAgo(120),
          template: {
            ...templateMetadata,
            ...requestShape,
            header_templates: currentDefinition.header_templates,
            body_template: currentDefinition.body_template,
          },
        },
        {
          revision: 2,
          saved_at: minutesAgo(60 * 26),
          template: {
            ...templateMetadata,
            ...requestShape,
            header_templates: { "X-Tenant": "{{ vars.tenant_id }}" },
            body_template: `{
  "From": "{{ data.from.address }}",
  "To": "{{ data.to[0].address }}",
  "Subject": "{{ data.subject }}"
}`,
          },
        },
        {
          revision: 1,
          saved_at: minutesAgo(60 * 50),
          template: {
            ...templateMetadata,
            required_variables: [],
            ...requestShape,
            header_templates: {},
            body_template: `{
  "From": "{{ data.from.address }}",
  "Subject": "{{ data.subject }}"
}`,
          },
        },
      ],
    ],
  ]);
}
