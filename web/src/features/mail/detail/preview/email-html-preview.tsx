import { toPng } from "html-to-image";
import {
  CameraIcon,
  ImageIcon,
  ImageOffIcon,
  MonitorIcon,
  SmartphoneIcon,
  TabletIcon,
} from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { buildPreviewDocument } from "@/features/mail/detail/preview/build-preview-document";
import { buildApiUrl } from "@/lib/api/api-client";
import type { EmailDetail } from "@/lib/api/types";
import { cn } from "@/lib/utils";

type PreviewDevice = "desktop" | "tablet" | "mobile";

const previewWidthClasses: Record<PreviewDevice, string> = {
  desktop: "w-full",
  tablet: "w-[768px] max-w-full",
  mobile: "w-[375px] max-w-full",
};

/** Matches the dimensions of the HTML body, so the iframe needs no inner scroll. */
function fitIframeHeight(previewFrame: HTMLIFrameElement) {
  const frameBody = previewFrame.contentDocument?.body;
  if (frameBody) {
    previewFrame.style.height = `${frameBody.scrollHeight + 32}px`;
  }
}

/**
 * Renders the email HTML in a sandboxed iframe: no scripts ever run, remote
 * images load only on request, and the width follows the chosen device.
 */
export function EmailHtmlPreview({ email }: { email: EmailDetail }) {
  const previewFrameRef = React.useRef<HTMLIFrameElement>(null);
  const [previewDevice, setPreviewDevice] =
    React.useState<PreviewDevice>("desktop");
  const [isRemoteImagesAllowed, setRemoteImagesAllowed] = React.useState(false);

  const previewDocument = React.useMemo(
    () =>
      buildPreviewDocument({
        htmlBody: email.html_body ?? "",
        attachments: email.attachments,
        isRemoteImagesAllowed,
        resolveApiUrl: (apiPath) =>
          new URL(buildApiUrl(apiPath), window.location.origin).toString(),
        appOrigin: window.location.origin,
      }),
    [email.html_body, email.attachments, isRemoteImagesAllowed],
  );

  const saveScreenshot = async () => {
    const frameBody = previewFrameRef.current?.contentDocument?.body;
    if (!frameBody) {
      return;
    }

    try {
      const imageDataUrl = await toPng(frameBody, {
        backgroundColor: "#ffffff",
      });
      const downloadLink = document.createElement("a");
      downloadLink.href = imageDataUrl;
      downloadLink.download = `${email.subject || "email"}.png`;
      downloadLink.click();
    } catch {
      toast.error("Could not capture the preview");
    }
  };

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          value={previewDevice}
          onValueChange={(selectedDevice) => {
            if (selectedDevice) {
              setPreviewDevice(selectedDevice as PreviewDevice);
            }
          }}
          aria-label="Preview width"
        >
          <ToggleGroupItem value="desktop" aria-label="Desktop width">
            <MonitorIcon />
          </ToggleGroupItem>
          <ToggleGroupItem value="tablet" aria-label="Tablet width">
            <TabletIcon />
          </ToggleGroupItem>
          <ToggleGroupItem value="mobile" aria-label="Mobile width">
            <SmartphoneIcon />
          </ToggleGroupItem>
        </ToggleGroup>
        <Button
          variant="outline"
          size="sm"
          aria-pressed={isRemoteImagesAllowed}
          onClick={() => {
            setRemoteImagesAllowed((wasAllowed) => !wasAllowed);
          }}
        >
          {isRemoteImagesAllowed ? <ImageIcon /> : <ImageOffIcon />}
          {isRemoteImagesAllowed ? "Remote images on" : "Load remote images"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto"
          onClick={() => void saveScreenshot()}
        >
          <CameraIcon />
          Screenshot
        </Button>
      </div>
      <div className="flex justify-center rounded-md border bg-muted/30 p-2">
        <iframe
          ref={previewFrameRef}
          title={`Preview of ${email.subject}`}
          // Same origin (for screenshots and inline images) but never scripts.
          sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
          srcDoc={previewDocument}
          onLoad={(loadEvent) => {
            fitIframeHeight(loadEvent.currentTarget);
          }}
          className={cn(
            "min-h-64 rounded bg-white transition-[width]",
            previewWidthClasses[previewDevice],
          )}
        />
      </div>
    </div>
  );
}
