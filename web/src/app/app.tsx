import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";

import { queryClient } from "@/app/query-client";
import { router } from "@/app/router";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppOverlaysProvider } from "@/features/shortcuts/app-overlays-provider";
import { ThemeProvider } from "@/features/theme/theme-provider";

export function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <AppOverlaysProvider>
            <RouterProvider router={router} />
            <Toaster />
          </AppOverlaysProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
