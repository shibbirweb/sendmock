import { toast } from "sonner";

import { RadioCardGroup } from "@/components/common/radio-card-group";
import {
  type ToastPosition,
  updateNotificationPreferences,
  useNotificationPreferences,
} from "@/features/notifications/notification-preferences";
import { SettingsSwitchRow } from "@/features/settings/settings-fields";
import { SettingsSectionCard } from "@/features/settings/settings-section-card";

const positionOptions: {
  value: ToastPosition;
  label: string;
  description: string;
}[] = [
  { value: "top-right", label: "Top right", description: "The default." },
  {
    value: "top-center",
    label: "Top center",
    description: "Above the page title.",
  },
  { value: "top-left", label: "Top left", description: "Over the sidebar." },
  {
    value: "bottom-right",
    label: "Bottom right",
    description: "Out of the way of the header.",
  },
  {
    value: "bottom-center",
    label: "Bottom center",
    description: "Above the page bottom.",
  },
  {
    value: "bottom-left",
    label: "Bottom left",
    description: "Over the sidebar footer.",
  },
];

/**
 * How notifications are announced in this browser (UI-08.1, UI-08.4): toasts
 * on or off, and where they appear. The bell keeps every notification either
 * way. Saved at once, like the theme; not a server setting.
 */
export function NotificationsSection() {
  const notificationPreferences = useNotificationPreferences();

  return (
    <SettingsSectionCard
      title="Notifications"
      description="New emails, SMS and failed webhook deliveries. Saved in this browser only, and applied at once."
    >
      <SettingsSwitchRow
        label="Show pop-up toasts"
        description="Off: no pop-ups; the bell at the top right still counts and lists every notification."
        isChecked={notificationPreferences.areToastsShown}
        onCheckedChange={(areToastsShown) => {
          updateNotificationPreferences({ areToastsShown });
        }}
      />
      <RadioCardGroup<ToastPosition>
        legend="Toast position"
        className="sm:grid-cols-3"
        options={positionOptions.map((positionOption) => ({
          ...positionOption,
          isDisabled: !notificationPreferences.areToastsShown,
        }))}
        selectedValue={notificationPreferences.toastPosition}
        onSelect={(toastPosition) => {
          updateNotificationPreferences({ toastPosition });
          toast("Toasts appear here", {
            description: "New notifications will pop up in this corner.",
          });
        }}
      />
    </SettingsSectionCard>
  );
}
