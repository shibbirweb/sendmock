import type { TemplateCategory } from "@/lib/api/types";

export const templateCategoryLabels: Record<TemplateCategory, string> = {
  generic: "Generic",
  "email-provider": "Email providers",
  "sms-provider": "SMS providers",
  "payment-provider": "Payment gateways",
  chat: "Chat",
  automation: "Automation",
  custom: "Custom",
};

/** Gallery and picker order. */
export const templateCategoryOrder: TemplateCategory[] = [
  "generic",
  "email-provider",
  "sms-provider",
  "payment-provider",
  "chat",
  "automation",
  "custom",
];
