import { useNavigate, useSearch } from "@tanstack/react-router";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ApiRequestDrawer } from "@/features/logs/http/api-request-drawer";
import { ApiRequestsPanel } from "@/features/logs/http/api-requests-panel";
import { SmtpSessionDrawer } from "@/features/logs/smtp/smtp-session-drawer";
import { SmtpSessionsPanel } from "@/features/logs/smtp/smtp-sessions-panel";

/** SMTP sessions and the API request log, failures included. */
export function LogsPage() {
  const search = useSearch({ from: "/logs" });
  const navigate = useNavigate({ from: "/logs" });
  const selectedTab =
    search.tab ?? (search.request !== undefined ? "http" : "smtp");

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="mx-auto grid w-full max-w-6xl min-w-0 grid-cols-1 gap-4 px-4 py-6 sm:px-6">
        <header className="grid gap-1">
          <h2 className="text-xl font-semibold">Logs</h2>
          <p className="text-sm text-muted-foreground">
            Every SMTP session and API request, including the ones that failed,
            so you can see why a client was rejected.
          </p>
        </header>
        <Tabs
          value={selectedTab}
          onValueChange={(nextTab) => {
            void navigate({
              search: { tab: nextTab === "http" ? "http" : undefined },
            });
          }}
          className="min-w-0 gap-4"
        >
          <TabsList>
            <TabsTrigger value="smtp">SMTP sessions</TabsTrigger>
            <TabsTrigger value="http">API requests</TabsTrigger>
          </TabsList>
          <TabsContent value="smtp">
            <SmtpSessionsPanel />
          </TabsContent>
          <TabsContent value="http">
            <ApiRequestsPanel />
          </TabsContent>
        </Tabs>
      </div>
      <SmtpSessionDrawer />
      <ApiRequestDrawer />
    </div>
  );
}
