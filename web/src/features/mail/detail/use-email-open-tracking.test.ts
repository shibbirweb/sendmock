import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { useEmailOpenTracking } from "@/features/mail/detail/use-email-open-tracking";
import type { EmailDetail } from "@/lib/api/types";

const sendUpdate = vi.fn();
const sendOpen = vi.fn();
let ruleMatchState = {
  isPending: true,
  data: undefined as { webhook_rules: unknown[] } | undefined,
};

vi.mock("@/lib/api/hooks/use-email-queries", () => ({
  useOpenEmail: () => ({ mutate: sendOpen }),
  useUpdateEmail: () => ({ mutate: sendUpdate }),
}));
vi.mock("@/lib/api/hooks/use-operation-availability", () => ({
  useOperationAvailability: () => ({ isAvailable: true }),
}));
vi.mock("@/lib/api/hooks/use-system-queries", () => ({
  useAppSettings: () => ({
    data: {
      fire_opened_events_on_view: true,
      count_views_with_webhook_rules: false,
      opened_event_mode: "first_open",
    },
  }),
}));
vi.mock("@/lib/api/hooks/use-webhook-rule-queries", () => ({
  useWebhookRuleMatch: () => ruleMatchState,
}));

const unreadEmail = {
  id: "01JB7T9Q2R5W8X3Y6Z1A4B7C9D",
  is_read: false,
  open_count: 0,
} as EmailDetail;

describe("email open tracking", () => {
  beforeEach(() => {
    sendUpdate.mockClear();
    sendOpen.mockClear();
    ruleMatchState = { isPending: true, data: undefined };
  });

  test("viewing marks the email read while the rule check is still pending", () => {
    renderHook(() => useEmailOpenTracking(unreadEmail));

    expect(sendUpdate).toHaveBeenCalledWith({
      emailId: unreadEmail.id,
      emailUpdate: { is_read: true },
    });
    expect(sendOpen).not.toHaveBeenCalled();
  });

  test("EM-27.2 a view a webhook rule would report is not counted as an open", () => {
    ruleMatchState = { isPending: false, data: { webhook_rules: [{}] } };

    const { result } = renderHook(() => useEmailOpenTracking(unreadEmail));

    expect(sendUpdate).toHaveBeenCalledOnce();
    expect(sendOpen).not.toHaveBeenCalled();
    expect(result.current.isViewNotCounted).toBe(true);
  });

  test("EM-11.1 a view no rule would report fires the open once", () => {
    ruleMatchState = { isPending: false, data: { webhook_rules: [] } };

    const { rerender } = renderHook(() => useEmailOpenTracking(unreadEmail));
    rerender();

    expect(sendOpen).toHaveBeenCalledOnce();
    expect(sendOpen).toHaveBeenCalledWith({
      emailId: unreadEmail.id,
      openSource: "ui",
    });
  });
});
