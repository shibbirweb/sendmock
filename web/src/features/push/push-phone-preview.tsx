import { BellIcon } from "lucide-react";
import * as React from "react";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { PushNotification } from "@/lib/api/types";
import { cn } from "@/lib/utils";

type PreviewStyle = "ios" | "android";

function formatClockTime(isoTimestamp: string): string {
  return new Date(isoTimestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

const previewStyleLabels: Record<PreviewStyle, string> = {
  ios: "iOS",
  android: "Android",
};

/** The card a lock screen shows: iOS puts the image beside the text, Android below it. */
function LockScreenCard({
  pushNotification,
  previewStyle,
}: {
  pushNotification: PushNotification;
  previewStyle: PreviewStyle;
}) {
  const isIos = previewStyle === "ios";

  return (
    <div
      data-preview-style={previewStyle}
      className={cn(
        "grid gap-1 bg-background/90 p-3 text-left shadow-sm",
        isIos ? "rounded-2xl" : "rounded-xl",
      )}
    >
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="flex size-4 items-center justify-center rounded bg-primary text-primary-foreground">
          <BellIcon className="size-2.5" aria-hidden="true" />
        </span>
        <span className={cn(isIos && "uppercase")}>Your app</span>
        <span className="ml-auto">
          {formatClockTime(pushNotification.created_at)}
        </span>
      </div>
      <div className="flex gap-2">
        <div className="grid min-w-0 flex-1 gap-0.5 text-sm">
          <p className="font-semibold break-words">
            {pushNotification.title ?? ""}
          </p>
          <p className="break-words whitespace-pre-line">
            {pushNotification.body ?? ""}
          </p>
        </div>
        {isIos && pushNotification.image_url !== null && (
          <img
            src={pushNotification.image_url}
            alt=""
            className="size-10 shrink-0 rounded-md object-cover"
          />
        )}
      </div>
      {!isIos && pushNotification.image_url !== null && (
        <img
          src={pushNotification.image_url}
          alt=""
          className="mt-1 max-h-32 w-full rounded-md object-cover"
        />
      )}
    </div>
  );
}

/** The notification as a phone's lock screen shows it, in the style its platform uses. */
export function PushPhonePreview({
  pushNotification,
}: {
  pushNotification: PushNotification;
}) {
  const [previewStyle, setPreviewStyle] = React.useState<PreviewStyle>(
    pushNotification.platform === "ios" ? "ios" : "android",
  );

  return (
    <section aria-label="Phone preview" className="grid gap-2">
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        aria-label="Preview style"
        value={previewStyle}
        onValueChange={(selectedStyle) => {
          if (selectedStyle) {
            setPreviewStyle(selectedStyle as PreviewStyle);
          }
        }}
        className="w-40"
      >
        {(Object.keys(previewStyleLabels) as PreviewStyle[]).map(
          (styleOption) => (
            <ToggleGroupItem
              key={styleOption}
              value={styleOption}
              className="flex-1 text-xs"
            >
              {previewStyleLabels[styleOption]}
            </ToggleGroupItem>
          ),
        )}
      </ToggleGroup>
      <div className="mx-auto w-full max-w-72 rounded-[2rem] border-4 border-foreground/80 bg-gradient-to-b from-primary/40 to-muted p-3 pt-10 pb-16">
        <LockScreenCard
          pushNotification={pushNotification}
          previewStyle={previewStyle}
        />
      </div>
    </section>
  );
}
