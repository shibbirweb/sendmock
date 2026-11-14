/** The "In your code" example of every recipe (WS-08.1). */
import type { CodeExample } from "./example-types";
import { mailAndWebhookRecipeExamples } from "./recipe-examples-mail-webhooks";
import { smsHttpAndPaymentRecipeExamples } from "./recipe-examples-sms-http-payments";

export const recipeExamples: CodeExample[] = [
  ...mailAndWebhookRecipeExamples,
  ...smsHttpAndPaymentRecipeExamples,
];
