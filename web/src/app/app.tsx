import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";

import { queryClient } from "@/app/query-client";
import { router } from "@/app/router";
import { TooltipProvider } from "@/components/ui/tooltip";
import { NotificationToaster } from "@/features/notifications/notification-toaster";
import { RealtimeProvider } from "@/features/realtime/realtime-provider";
import { AppOverlaysProvider } from "@/features/shortcuts/app-overlays-provider";
import { ThemeProvider } from "@/features/theme/theme-provider";
import { DailyUpdateNotifier } from "@/features/updates/daily-update-notifier";

export function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <AppOverlaysProvider>
            <RealtimeProvider>
              <RouterProvider router={router} />
              <NotificationToaster />
              <DailyUpdateNotifier />
            </RealtimeProvider>
          </AppOverlaysProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
