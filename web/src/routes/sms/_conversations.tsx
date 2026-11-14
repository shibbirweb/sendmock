import { createFileRoute } from "@tanstack/react-router";

import { SmsLayout } from "@/features/sms/sms-layout";

export const Route = createFileRoute("/sms/_conversations")({
  component: SmsLayout,
});
