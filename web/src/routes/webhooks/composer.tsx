import { createFileRoute } from "@tanstack/react-router";

import { ComposerPage } from "@/features/webhooks/composer/composer-page";

export const Route = createFileRoute("/webhooks/composer")({
  component: ComposerPage,
});
