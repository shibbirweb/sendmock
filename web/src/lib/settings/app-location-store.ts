import {
  type AppLocation,
  appLocationHosts,
} from "@/lib/settings/build-connection-snippets";

type AppLocationListener = () => void;

const appLocationStorageKey = "sendmock.app-location";
const appLocationListeners = new Set<AppLocationListener>();
let storedAppLocation: AppLocation | null = readStorage();

function isAppLocation(storedValue: string | null): storedValue is AppLocation {
  return storedValue !== null && storedValue in appLocationHosts;
}

function readStorage(): AppLocation | null {
  try {
    const storedValue = localStorage.getItem(appLocationStorageKey);

    return isAppLocation(storedValue) ? storedValue : null;
  } catch {
    // Storage can be blocked (private mode); fall back to the default host.
    return null;
  }
}

/** The "Where does your app run?" choice, or null until someone picks one. */
export function readStoredAppLocation(): AppLocation | null {
  return storedAppLocation;
}

/** Remembers the choice and tells every card and Settings > Connection (UI-04.3). */
export function storeAppLocation(appLocation: AppLocation) {
  storedAppLocation = appLocation;
  try {
    localStorage.setItem(appLocationStorageKey, appLocation);
  } catch {
    // Not remembered across reloads, but still shared for this visit.
  }

  for (const appLocationListener of appLocationListeners) {
    appLocationListener();
  }
}

export function subscribeToAppLocation(
  appLocationListener: AppLocationListener,
): () => void {
  appLocationListeners.add(appLocationListener);

  return () => {
    appLocationListeners.delete(appLocationListener);
  };
}
