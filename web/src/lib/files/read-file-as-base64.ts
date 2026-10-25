/** The file's bytes as base64, without the `data:...;base64,` prefix. */
export function readFileAsBase64(selectedFile: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fileReader = new FileReader();
    fileReader.addEventListener("load", () => {
      const dataUrl = String(fileReader.result ?? "");
      resolve(dataUrl.slice(dataUrl.indexOf(",") + 1));
    });
    fileReader.addEventListener("error", () => {
      reject(fileReader.error ?? new Error("Could not read the file"));
    });
    fileReader.readAsDataURL(selectedFile);
  });
}
