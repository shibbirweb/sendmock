import type { MessageRuleKind } from "@/lib/api/hooks/use-message-rule-queries";

/** Wording that differs between tag rules and auto-forward rules. */
export const messageRuleLabels: Record<
  MessageRuleKind,
  {
    cardTitle: string;
    cardDescription: string;
    emptyText: string;
    sheetTitle: string;
    sheetDescription: string;
    actionHeading: string;
  }
> = {
  "tag-rules": {
    cardTitle: "Tag rules",
    cardDescription:
      "Add a tag to arriving emails that match a filter, in this order. Tags show in the list and the tag: search.",
    emptyText: "No tag rules yet.",
    sheetTitle: "Add a tag rule",
    sheetDescription: "Arriving emails that match the filter get the tag.",
    actionHeading: "Tag",
  },
  "forward-rules": {
    cardTitle: "Auto-forward rules",
    cardDescription:
      "Release a real copy of arriving emails that match a filter, through the relay above and only to allowed recipients.",
    emptyText: "No auto-forward rules yet.",
    sheetTitle: "Add an auto-forward rule",
    sheetDescription:
      "Arriving emails that match the filter are released to these addresses.",
    actionHeading: "Forward to",
  },
};
