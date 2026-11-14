import { useNavigate, useSearch } from "@tanstack/react-router";

import { usePageTitle } from "@/hooks/use-page-title";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessagingServicesPanel } from "@/features/numbers/messaging-services/messaging-services-panel";
import { VirtualNumbersPanel } from "@/features/numbers/virtual-numbers/virtual-numbers-panel";

/** Virtual numbers and Messaging Services, like a provider console. */
export function NumbersPage() {
  usePageTitle("Numbers");
  const { tab: selectedTab = "numbers" } = useSearch({ from: "/numbers" });
  const navigate = useNavigate({ from: "/numbers" });

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="mx-auto grid w-full max-w-6xl min-w-0 grid-cols-1 gap-4 px-4 py-6 sm:px-6">
        <header className="grid gap-1">
          <h2 className="text-xl font-semibold">Numbers</h2>
          <p className="text-sm text-muted-foreground">
            Fake numbers with inbound webhooks and status callbacks, and the
            Messaging Services that pool them.
          </p>
        </header>
        <Tabs
          value={selectedTab}
          onValueChange={(nextTab) => {
            void navigate({
              search: { tab: nextTab === "services" ? "services" : undefined },
            });
          }}
          className="min-w-0 gap-4"
        >
          <TabsList>
            <TabsTrigger value="numbers">Numbers</TabsTrigger>
            <TabsTrigger value="services">Messaging Services</TabsTrigger>
          </TabsList>
          <TabsContent value="numbers">
            <VirtualNumbersPanel />
          </TabsContent>
          <TabsContent value="services">
            <MessagingServicesPanel />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
