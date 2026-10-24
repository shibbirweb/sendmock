import * as React from "react";

export type ThemePreference = "dark" | "light" | "system";
export type ResolvedTheme = "dark" | "light";

type ThemeContextValue = {
  themePreference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setThemePreference: (themePreference: ThemePreference) => void;
  cycleThemePreference: () => void;
};

const themeStorageKey = "messagehook.theme";
const darkColorSchemeQuery = "(prefers-color-scheme: dark)";
const themePreferenceOrder: ThemePreference[] = ["system", "light", "dark"];

const ThemeContext = React.createContext<ThemeContextValue | undefined>(
  undefined,
);

function isThemePreference(value: string | null): value is ThemePreference {
  if (value === null) {
    return false;
  }

  return themePreferenceOrder.includes(value as ThemePreference);
}

function readStoredThemePreference(): ThemePreference {
  try {
    const storedValue = localStorage.getItem(themeStorageKey);
    if (isThemePreference(storedValue)) {
      return storedValue;
    }
  } catch {
    // Storage can be blocked (private mode); fall back to the system theme.
  }

  return "system";
}

function storeThemePreference(themePreference: ThemePreference) {
  try {
    localStorage.setItem(themeStorageKey, themePreference);
  } catch {
    // Not persisting is acceptable; the choice still applies to this tab.
  }
}

function readSystemTheme(): ResolvedTheme {
  if (window.matchMedia(darkColorSchemeQuery).matches) {
    return "dark";
  }

  return "light";
}

function resolveTheme(themePreference: ThemePreference): ResolvedTheme {
  if (themePreference === "system") {
    return readSystemTheme();
  }

  return themePreference;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themePreference, setThemePreferenceState] =
    React.useState<ThemePreference>(readStoredThemePreference);
  const [resolvedTheme, setResolvedTheme] = React.useState<ResolvedTheme>(() =>
    resolveTheme(readStoredThemePreference()),
  );

  React.useEffect(() => {
    const applyResolvedTheme = () => {
      const nextResolvedTheme = resolveTheme(themePreference);
      document.documentElement.classList.remove("light", "dark");
      document.documentElement.classList.add(nextResolvedTheme);
      setResolvedTheme(nextResolvedTheme);
    };

    applyResolvedTheme();

    if (themePreference !== "system") {
      return undefined;
    }

    const systemThemeQuery = window.matchMedia(darkColorSchemeQuery);
    systemThemeQuery.addEventListener("change", applyResolvedTheme);

    return () => {
      systemThemeQuery.removeEventListener("change", applyResolvedTheme);
    };
  }, [themePreference]);

  const setThemePreference = React.useCallback(
    (nextThemePreference: ThemePreference) => {
      storeThemePreference(nextThemePreference);
      setThemePreferenceState(nextThemePreference);
    },
    [],
  );

  const cycleThemePreference = React.useCallback(() => {
    const currentIndex = themePreferenceOrder.indexOf(themePreference);
    const nextIndex = (currentIndex + 1) % themePreferenceOrder.length;
    setThemePreference(themePreferenceOrder[nextIndex] ?? "system");
  }, [themePreference, setThemePreference]);

  const contextValue = React.useMemo(
    () => ({
      themePreference,
      resolvedTheme,
      setThemePreference,
      cycleThemePreference,
    }),
    [themePreference, resolvedTheme, setThemePreference, cycleThemePreference],
  );

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const themeContext = React.useContext(ThemeContext);

  if (themeContext === undefined) {
    throw new Error("useTheme must be used inside ThemeProvider");
  }

  return themeContext;
}
