import { createFileRoute } from "@tanstack/react-router";

import { ScenariosPage } from "@/features/scenarios/scenarios-page";

export const Route = createFileRoute("/scenarios")({
  component: ScenariosPage,
});
