import type { QueryClient } from "@tanstack/react-query";
import {
  createRootRouteWithContext,
  type ErrorComponentProps,
  Link,
} from "@tanstack/react-router";

import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";

export type RouterContext = {
  queryClient: QueryClient;
};

export const Route = createRootRouteWithContext<RouterContext>()({
  component: AppShell,
  notFoundComponent: NotFoundPage,
  errorComponent: RouteErrorPage,
});

function RouteErrorPage({ error }: ErrorComponentProps) {
  const errorMessage =
    error instanceof Error ? error.message : "An unexpected error happened.";

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
      <h2 className="text-lg font-semibold">Something went wrong</h2>
      <p className="max-w-md text-sm text-muted-foreground">{errorMessage}</p>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          window.location.reload();
        }}
      >
        Reload the page
      </Button>
    </div>
  );
}

function NotFoundPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
      <h2 className="text-lg font-semibold">Page not found</h2>
      <p className="text-sm text-muted-foreground">
        This page does not exist. Use the sidebar or press ⌘K to jump somewhere.
      </p>
      <Button asChild variant="outline" size="sm">
        <Link to="/">Back to overview</Link>
      </Button>
    </div>
  );
}
