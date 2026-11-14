import { LaptopIcon, MoonIcon, SunIcon } from "lucide-react";

import { IconButton } from "@/components/common/icon-button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { appShortcuts } from "@/features/shortcuts/shortcut-catalog";
import {
  type ThemePreference,
  useTheme,
} from "@/features/theme/theme-provider";

const themeOptions: { value: ThemePreference; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

export function ThemeToggle() {
  const { themePreference, resolvedTheme, setThemePreference } = useTheme();
  const CurrentThemeIcon =
    themePreference === "system"
      ? LaptopIcon
      : resolvedTheme === "dark"
        ? MoonIcon
        : SunIcon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <IconButton
          variant="ghost"
          label="Change theme"
          shortcutKeys={appShortcuts.switchTheme.keys}
        >
          <CurrentThemeIcon />
        </IconButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup
          value={themePreference}
          onValueChange={(selectedValue) => {
            setThemePreference(selectedValue as ThemePreference);
          }}
        >
          {themeOptions.map((themeOption) => (
            <DropdownMenuRadioItem
              key={themeOption.value}
              value={themeOption.value}
            >
              {themeOption.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
