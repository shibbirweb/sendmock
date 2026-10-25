import { useNavigate, useSearch } from "@tanstack/react-router";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VerifyServicesPanel } from "@/features/verify/services/verify-services-panel";
import { VerificationDrawer } from "@/features/verify/verifications/verification-drawer";
import { VerificationsPanel } from "@/features/verify/verifications/verifications-panel";

/** Twilio Verify: verifications and the services apps verify against. */
export function VerifyPage() {
  const { tab: selectedTab = "verifications" } = useSearch({
    from: "/sms/verify",
  });
  const navigate = useNavigate({ from: "/sms/verify" });

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="mx-auto grid w-full max-w-6xl min-w-0 grid-cols-1 gap-4 px-4 py-6 sm:px-6">
        <header className="grid gap-1">
          <h2 className="text-xl font-semibold">Verify</h2>
          <p className="text-sm text-muted-foreground">
            Twilio Verify emulation: every code your app requests, its attempts
            and expiry, and controls to force any outcome.
          </p>
        </header>
        <Tabs
          value={selectedTab}
          onValueChange={(nextTab) => {
            void navigate({
              search: {
                tab: nextTab === "services" ? "services" : undefined,
              },
            });
          }}
          className="min-w-0 gap-4"
        >
          <TabsList>
            <TabsTrigger value="verifications">Verifications</TabsTrigger>
            <TabsTrigger value="services">Services</TabsTrigger>
          </TabsList>
          <TabsContent value="verifications">
            <VerificationsPanel />
          </TabsContent>
          <TabsContent value="services">
            <VerifyServicesPanel />
          </TabsContent>
        </Tabs>
      </div>
      <VerificationDrawer />
    </div>
  );
}
