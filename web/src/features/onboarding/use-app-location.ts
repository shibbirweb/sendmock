import * as React from "react";

import { useAppInfo } from "@/lib/api/hooks/use-system-queries";
import {
  readStoredAppLocation,
  storeAppLocation,
  subscribeToAppLocation,
} from "@/lib/settings/app-location-store";
import type { AppLocation } from "@/lib/settings/build-connection-snippets";

/**
 * Where the user's app runs, shared by every how to connect card and
 * Settings > Connection. Defaults to the Compose host in Docker (UI-04.3).
 */
export function useAppLocation(): [
  AppLocation,
  (appLocation: AppLocation) => void,
] {
  const appInfoQuery = useAppInfo();
  const storedAppLocation = React.useSyncExternalStore(
    subscribeToAppLocation,
    readStoredAppLocation,
  );
  const defaultAppLocation: AppLocation =
    appInfoQuery.data?.is_container === true ? "compose" : "this-machine";

  return [storedAppLocation ?? defaultAppLocation, storeAppLocation];
}
