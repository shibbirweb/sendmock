import { useNavigate, useSearch } from "@tanstack/react-router";

import type { HttpCatcherSearchParams } from "@/routes/http";

/** The bin, tab and request of the HTTP screen, kept in the URL. */
export function useHttpCatcherSearch() {
  const catcherSearch = useSearch({ from: "/http" });
  const navigate = useNavigate({ from: "/http" });

  const updateSearch = (changedParams: Partial<HttpCatcherSearchParams>) => {
    void navigate({
      search: (previousSearch) => ({ ...previousSearch, ...changedParams }),
    });
  };

  return {
    selectedBinId: catcherSearch.bin ?? null,
    isResponsesTab: catcherSearch.tab === "responses",
    selectedRequestId: catcherSearch.request ?? null,
    selectBin: (binId: string | null) => {
      updateSearch({ bin: binId ?? undefined, request: undefined });
    },
    showResponsesTab: (isResponses: boolean) => {
      updateSearch({ tab: isResponses ? "responses" : undefined });
    },
    selectRequest: (requestId: string | null) => {
      updateSearch({ request: requestId ?? undefined });
    },
  };
}
