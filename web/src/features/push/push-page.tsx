import { usePageTitle } from "@/hooks/use-page-title";
import { PushDrawer } from "@/features/push/push-drawer";
import { PushListPanel } from "@/features/push/push-list-panel";

/** Push notifications apps send through FCM, Expo and OneSignal (PN-01). */
export function PushPage() {
  usePageTitle("Push");

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="mx-auto grid w-full max-w-6xl min-w-0 grid-cols-1 gap-4 px-4 py-6 sm:px-6">
        <header className="grid gap-1">
          <h2 className="text-xl font-semibold">Push</h2>
          <p className="text-sm text-muted-foreground">
            Every push notification your app sends through FCM, Expo or
            OneSignal, as the phone would show it.
          </p>
        </header>
        <PushListPanel />
      </div>
      <PushDrawer />
    </div>
  );
}
