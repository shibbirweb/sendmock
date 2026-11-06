/**
 * The `tar` that reads and writes the release archives. On Windows the workflows' bash shell
 * puts Git's GNU tar first on the PATH, which ignores `-a` and writes a tar file under a `.zip`
 * name; Windows' own tar.exe is bsdtar, which writes and reads real zip files.
 */
export function readTarCommand(): string {
  if (process.platform === "win32") {
    return `${process.env.SystemRoot ?? "C:\\Windows"}\\System32\\tar.exe`;
  }
  return "tar";
}

/** A zip file starts with `PK\x03\x04`; Expand-Archive and Scoop refuse anything else. */
export function hasZipSignature(fileBytes: Uint8Array): boolean {
  return (
    fileBytes[0] === 0x50 &&
    fileBytes[1] === 0x4b &&
    fileBytes[2] === 0x03 &&
    fileBytes[3] === 0x04
  );
}
