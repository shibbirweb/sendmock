import type { EmailAttachment } from "@/lib/api/types";

type PreviewDocumentOptions = {
  htmlBody: string;
  attachments: EmailAttachment[];
  isRemoteImagesAllowed: boolean;
  /** Turns an API path into an absolute URL the iframe can load. */
  resolveApiUrl: (apiPath: string) => string;
  appOrigin: string;
};

/** Points `cid:` references at the matching inline attachment (EM-04.4). */
export function replaceContentIdReferences(
  htmlBody: string,
  attachments: EmailAttachment[],
  resolveApiUrl: (apiPath: string) => string,
): string {
  return htmlBody.replace(
    /cid:([^"'\s)>]+)/gi,
    (cidReference, contentId: string) => {
      const matchingAttachment = attachments.find(
        (attachment) => attachment.content_id === contentId,
      );

      return matchingAttachment
        ? resolveApiUrl(
            matchingAttachment.download_url.replace(/^\/api\/v1/, ""),
          )
        : cidReference;
    },
  );
}

/**
 * Wraps the email HTML in a document whose Content-Security-Policy blocks
 * scripts always and remote images until the user allows them (EM-04.1, 04.2).
 */
export function buildPreviewDocument({
  htmlBody,
  attachments,
  isRemoteImagesAllowed,
  resolveApiUrl,
  appOrigin,
}: PreviewDocumentOptions): string {
  const imageSources = isRemoteImagesAllowed
    ? `data: blob: ${appOrigin} https: http:`
    : `data: blob: ${appOrigin}`;
  const contentSecurityPolicy = [
    "default-src 'none'",
    "script-src 'none'",
    `img-src ${imageSources}`,
    "style-src 'unsafe-inline'",
    "font-src data:",
  ].join("; ");
  const emailHtml = replaceContentIdReferences(
    htmlBody,
    attachments,
    resolveApiUrl,
  );

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${contentSecurityPolicy}">
<meta name="viewport" content="width=device-width, initial-scale=1">
<base target="_blank">
<style>body{margin:16px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#18181b;background:#fff;word-wrap:break-word}img{max-width:100%;height:auto}</style>
</head>
<body>${emailHtml}</body>
</html>`;
}
