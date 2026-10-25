import * as React from "react";
import { toast } from "sonner";

import type { InlineSmsMedia } from "@/lib/api/types";
import { readFileAsBase64 } from "@/lib/files/read-file-as-base64";

/** The same limits the API applies (SM-15.3), checked before sending. */
const maxComposerMediaCount = 10;
const maxComposerMediaBytes = 5 * 1024 * 1024;

export type ComposerMediaFile = {
  fileId: number;
  file: File;
  /** Object URL for image previews; null for other files. */
  previewUrl: string | null;
};

function revokePreview(mediaFile: ComposerMediaFile) {
  if (mediaFile.previewUrl !== null) {
    URL.revokeObjectURL(mediaFile.previewUrl);
  }
}

/** Files picked in "Reply as recipient" before they are sent (SM-15.5). */
export function useComposerMedia() {
  const nextFileIdRef = React.useRef(1);
  const [mediaFiles, setMediaFiles] = React.useState<ComposerMediaFile[]>([]);

  const mediaFilesRef = React.useRef(mediaFiles);
  React.useEffect(() => {
    mediaFilesRef.current = mediaFiles;
  }, [mediaFiles]);

  // Preview URLs are released when a file leaves the composer, and on unmount.
  React.useEffect(
    () => () => {
      mediaFilesRef.current.forEach(revokePreview);
    },
    [],
  );

  const addFiles = (pickedFiles: File[]) => {
    const totalBytes = [
      ...mediaFiles.map((mediaFile) => mediaFile.file),
      ...pickedFiles,
    ].reduce((byteSum, pickedFile) => byteSum + pickedFile.size, 0);
    if (mediaFiles.length + pickedFiles.length > maxComposerMediaCount) {
      toast.error(`Attach at most ${maxComposerMediaCount} files`);
      return;
    }
    if (totalBytes > maxComposerMediaBytes) {
      toast.error("Media can be at most 5 MB in total");
      return;
    }

    const addedFiles = pickedFiles.map((pickedFile) => {
      const fileId = nextFileIdRef.current;
      nextFileIdRef.current += 1;

      return {
        fileId,
        file: pickedFile,
        previewUrl: pickedFile.type.startsWith("image/")
          ? URL.createObjectURL(pickedFile)
          : null,
      };
    });
    setMediaFiles((previousFiles) => [...previousFiles, ...addedFiles]);
  };

  const removeFile = (fileId: number) => {
    setMediaFiles((previousFiles) =>
      previousFiles.filter((mediaFile) => mediaFile.fileId !== fileId),
    );
  };

  const clearFiles = () => {
    setMediaFiles([]);
  };

  /** The picked files as the inline `media` of an API request. */
  const readAsInlineMedia = (): Promise<InlineSmsMedia[]> =>
    Promise.all(
      mediaFiles.map(async ({ file }) => ({
        filename: file.name,
        content: await readFileAsBase64(file),
        content_type: file.type || undefined,
      })),
    );

  return { mediaFiles, addFiles, removeFile, clearFiles, readAsInlineMedia };
}
