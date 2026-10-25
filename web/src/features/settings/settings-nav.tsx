import { Link, useNavigate } from "@tanstack/react-router";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  type SettingsSectionId,
  settingsSections,
} from "@/features/settings/settings-sections";
import { cn } from "@/lib/utils";

function ChaosBadge() {
  return (
    <span className="ml-auto rounded-full bg-destructive/10 px-1.5 text-[10px] font-medium text-destructive">
      Chaos on
    </span>
  );
}

/** Section list on wide screens, a picker on phones. */
export function SettingsNav({
  selectedSectionId,
  isChaosOn,
}: {
  selectedSectionId: SettingsSectionId;
  isChaosOn: boolean;
}) {
  const navigate = useNavigate({ from: "/settings" });

  return (
    <>
      <div className="lg:hidden">
        <Select
          value={selectedSectionId}
          onValueChange={(nextSectionId) => {
            void navigate({
              search: { section: nextSectionId as SettingsSectionId },
            });
          }}
        >
          <SelectTrigger aria-label="Settings section" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {settingsSections.map((settingsSection) => (
              <SelectItem
                key={settingsSection.sectionId}
                value={settingsSection.sectionId}
              >
                {settingsSection.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <nav aria-label="Settings sections" className="hidden lg:block">
        <ul className="grid gap-0.5">
          {settingsSections.map(({ sectionId, label, icon: SectionIcon }) => {
            const isSelected = sectionId === selectedSectionId;

            return (
              <li key={sectionId}>
                <Link
                  to="/settings"
                  search={{
                    section: sectionId === "general" ? undefined : sectionId,
                  }}
                  aria-current={isSelected ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground",
                    isSelected && "bg-muted font-medium text-foreground",
                  )}
                >
                  <SectionIcon className="size-4" />
                  {label}
                  {sectionId === "chaos" && isChaosOn && <ChaosBadge />}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
