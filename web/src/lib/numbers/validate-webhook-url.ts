/** True for an absolute `http` or `https` URL. */
export function isHttpUrl(urlText: string): boolean {
  try {
    const parsedUrl = new URL(urlText);

    return parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:";
  } catch {
    return false;
  }
}

export const httpUrlError = "Enter an http:// or https:// URL";
