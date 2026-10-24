import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";

import { queryClient } from "@/app/query-client";
import { router } from "@/app/router";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  ToastClearAllButton,
  toastStackTopOffsetPx,
} from "@/features/notifications/toast-clear-all-button";
import { RealtimeProvider } from "@/features/realtime/realtime-provider";
import { AppOverlaysProvider } from "@/features/shortcuts/app-overlays-provider";
import { ThemeProvider } from "@/features/theme/theme-provider";

export function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <AppOverlaysProvider>
            <RealtimeProvider>
              <RouterProvider router={router} />
              <Toaster
                position="top-right"
                closeButton
                offset={{ top: toastStackTopOffsetPx, right: 24 }}
                mobileOffset={{ top: toastStackTopOffsetPx, right: 16 }}
              />
              <ToastClearAllButton />
            </RealtimeProvider>
          </AppOverlaysProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
