import type { MessageProviderArea } from "@/lib/api/types";

/** The words each area's Providers screen uses (docs/plan/22-configurable-providers.md). */
export const providerAreaCopy: Record<
  MessageProviderArea,
  {
    menuName: string;
    /** "email" or "SMS", inside a sentence. */
    areaNoun: string;
    title: string;
    description: string;
    namePlaceholder: string;
  }
> = {
  email: {
    menuName: "Mail",
    areaNoun: "email",
    title: "Email providers",
    description:
      "The email APIs SendMock answers like the real provider. Change a built-in, remove the ones you do not use, or add your own.",
    namePlaceholder: "Mailjet",
  },
  sms: {
    menuName: "SMS",
    areaNoun: "SMS",
    title: "SMS providers",
    description:
      "The SMS APIs SendMock answers like the real provider. Change a built-in, remove the ones you do not use, or add your own.",
    namePlaceholder: "SSL Wireless",
  },
};
