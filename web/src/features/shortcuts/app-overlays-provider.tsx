import * as React from "react";

type AppOverlaysContextValue = {
  isCommandPaletteOpen: boolean;
  setCommandPaletteOpen: (isOpen: boolean) => void;
  isShortcutHelpOpen: boolean;
  setShortcutHelpOpen: (isOpen: boolean) => void;
};

const AppOverlaysContext = React.createContext<
  AppOverlaysContextValue | undefined
>(undefined);

/** Holds the open state of app-wide overlays opened by shortcuts and buttons. */
export function AppOverlaysProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isCommandPaletteOpen, setCommandPaletteOpen] = React.useState(false);
  const [isShortcutHelpOpen, setShortcutHelpOpen] = React.useState(false);

  const contextValue = React.useMemo(
    () => ({
      isCommandPaletteOpen,
      setCommandPaletteOpen,
      isShortcutHelpOpen,
      setShortcutHelpOpen,
    }),
    [isCommandPaletteOpen, isShortcutHelpOpen],
  );

  return (
    <AppOverlaysContext.Provider value={contextValue}>
      {children}
    </AppOverlaysContext.Provider>
  );
}

export function useAppOverlays(): AppOverlaysContextValue {
  const overlaysContext = React.useContext(AppOverlaysContext);

  if (overlaysContext === undefined) {
    throw new Error("useAppOverlays must be used inside AppOverlaysProvider");
  }

  return overlaysContext;
}
