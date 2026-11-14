/** Saves text as a file through the browser's download, e.g. a TOML export. */
export function downloadTextFile(
  fileText: string,
  fileName: string,
  contentType = "application/toml",
) {
  const fileUrl = URL.createObjectURL(
    new Blob([fileText], { type: contentType }),
  );
  const downloadLink = document.createElement("a");
  downloadLink.href = fileUrl;
  downloadLink.download = fileName;
  downloadLink.click();
  URL.revokeObjectURL(fileUrl);
}
