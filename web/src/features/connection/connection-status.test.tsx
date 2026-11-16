import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import { ConnectionStatus } from "@/features/connection/connection-status";
import { queryKeys } from "@/lib/api/query-keys";

vi.mock("@/components/ui/sidebar", () => ({
  useSidebar: () => ({ state: "expanded" }),
}));

vi.mock("@/features/realtime/realtime-provider", () => ({
  useRealtimeConnectionState: () => "connected",
}));

function renderConnectionStatus(serverVersion: string | null) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, enabled: false } },
  });
  if (serverVersion !== null) {
    queryClient.setQueryData(queryKeys.system.info, {
      version: serverVersion,
    });
  }
  render(
    <QueryClientProvider client={queryClient}>
      <ConnectionStatus />
    </QueryClientProvider>,
  );
}

describe("ConnectionStatus", () => {
  test("UI-01.5 shows the version the server reports in /info", () => {
    renderConnectionStatus("1.0.0");

    expect(screen.getByRole("status")).toHaveTextContent("v1.0.0");
    expect(screen.getByRole("status")).toHaveAttribute(
      "title",
      expect.stringContaining("version 1.0.0"),
    );
  });

  test("UI-01.5 shows no version, never a placeholder, until /info answers", () => {
    renderConnectionStatus(null);

    expect(screen.getByRole("status")).toHaveTextContent("Live");
    expect(screen.getByRole("status")).not.toHaveTextContent(/v\d/);
    expect(screen.getByRole("status")).not.toHaveTextContent("0.0.0-dev");
  });
});
