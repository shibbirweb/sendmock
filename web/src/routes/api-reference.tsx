import { createFileRoute } from "@tanstack/react-router";

import { ApiReferencePage } from "@/features/api-reference/api-reference-page";

export const Route = createFileRoute("/api-reference")({
  component: ApiReferencePage,
});
