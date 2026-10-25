import { DownloadIcon } from "lucide-react";
import * as React from "react";

import { CopyButton } from "@/components/common/copy-button";
import { HttpBodyView } from "@/components/common/http-body-view";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { buildApiUrl } from "@/lib/api/api-client";
import type { CapturedHttpRequest } from "@/lib/api/types";
import { formatBytes } from "@/lib/format/format-values";

/** The request body pretty or raw, and its uploaded files to download (HC-01.2). */
export function CapturedBodyView({
  capturedRequest,
}: {
  capturedRequest: CapturedHttpRequest;
}) {
  const [bodyView, setBodyView] = React.useState<"pretty" | "raw">("pretty");

  return (
    <div className="grid gap-3">
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        aria-label="Body view"
        className="justify-self-start"
        value={bodyView}
        onValueChange={(selectedView) => {
          if (selectedView !== "") {
            setBodyView(selectedView as "pretty" | "raw");
          }
        }}
      >
        <ToggleGroupItem value="pretty" className="px-3">
          Pretty
        </ToggleGroupItem>
        <ToggleGroupItem value="raw" className="px-3">
          Raw
        </ToggleGroupItem>
      </ToggleGroup>
      {bodyView === "pretty" ? (
        <HttpBodyView
          title="Request body"
          bodyText={capturedRequest.body}
          contentType={capturedRequest.content_type}
        />
      ) : (
        <section aria-label="Raw body" className="grid gap-1.5">
          <div className="flex justify-end">
            <CopyButton
              copyText={capturedRequest.body}
              label="Copy raw body"
              className="size-6"
            />
          </div>
          <pre className="overflow-x-auto rounded-md border bg-muted/30 p-3 font-mono text-xs break-all whitespace-pre-wrap">
            {capturedRequest.body === "" ? "(empty)" : capturedRequest.body}
          </pre>
        </section>
      )}
      {capturedRequest.files.length > 0 && (
        <section aria-label="Files" className="grid gap-1.5">
          <h4 className="text-xs font-medium text-muted-foreground">Files</h4>
          <ul className="grid gap-1">
            {capturedRequest.files.map((capturedFile) => (
              <li
                key={capturedFile.file_index}
                className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
              >
                <span className="min-w-0 flex-1 truncate">
                  {capturedFile.filename}
                  <span className="ml-2 text-xs text-muted-foreground">
                    {capturedFile.field_name}, {capturedFile.content_type},{" "}
                    {formatBytes(capturedFile.size_bytes)}
                  </span>
                </span>
                <Button variant="outline" size="sm" asChild>
                  <a
                    href={buildApiUrl(
                      `/http/requests/${capturedRequest.id}/files/${capturedFile.file_index}`,
                    )}
                    download={capturedFile.filename}
                  >
                    <DownloadIcon />
                    Download
                  </a>
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
