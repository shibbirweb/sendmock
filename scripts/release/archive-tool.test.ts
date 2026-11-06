import { describe, expect, test } from "bun:test";

import { hasZipSignature, readTarCommand } from "./archive-tool";

describe("release archives", () => {
  test("DS-01.5 a Windows archive must be a real zip file, not a tar file named .zip", () => {
    expect(
      hasZipSignature(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14])),
    ).toBe(true);
    // A tar file starts with the first file's name.
    expect(hasZipSignature(new TextEncoder().encode("sendmock.exe\0"))).toBe(
      false,
    );
    expect(hasZipSignature(new Uint8Array([]))).toBe(false);
  });

  test("DS-01.5 Windows uses its own tar.exe, which writes zip files", () => {
    expect(readTarCommand()).toBe(
      process.platform === "win32"
        ? `${process.env.SystemRoot ?? "C:\\Windows"}\\System32\\tar.exe`
        : "tar",
    );
  });
});
