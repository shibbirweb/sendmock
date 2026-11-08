import { describe, expect, test } from "bun:test";

import { buildAurPackage, toPacmanVersion } from "./aur-package";
import { buildCoprSpec, formatRpmChangelogDate } from "./copr-spec";
import { parseChecksums } from "./homebrew-formula";
import { buildNixPackage, toSriHash } from "./nix-package";

const hexChecksum = "ab".repeat(32);
const checksums = parseChecksums(
  [
    `${hexChecksum}  sendmock-x86_64-unknown-linux-musl.tar.gz`,
    `${"cd".repeat(32)}  sendmock-aarch64-unknown-linux-musl.tar.gz`,
    `${"ef".repeat(32)}  sendmock-x86_64-apple-darwin.tar.gz`,
    `${"01".repeat(32)}  sendmock-aarch64-apple-darwin.tar.gz`,
  ].join("\n"),
);

describe("AUR package", () => {
  test("DS-03.5 sendmock-bin installs the release's Linux archive for x86_64 and aarch64", () => {
    const pkgbuild = buildAurPackage("1.2.0", "stable", checksums);

    expect(pkgbuild).toContain("pkgname=sendmock-bin\npkgver=1.2.0\n");
    expect(pkgbuild).toContain(
      'source_x86_64=("sendmock-1.2.0-x86_64.tar.gz::https://github.com/shibbirweb/sendmock/releases/download/v1.2.0/sendmock-x86_64-unknown-linux-musl.tar.gz")',
    );
    expect(pkgbuild).toContain(`sha256sums_x86_64=('${hexChecksum}')`);
    expect(pkgbuild).toContain("conflicts=('sendmock' 'sendmock-beta-bin')");
  });

  test("DS-03.5 sendmock-beta-bin carries the beta with a version pacman sorts before the stable", () => {
    const pkgbuild = buildAurPackage("1.3.0-beta.2", "beta", checksums);

    expect(pkgbuild).toContain(
      "pkgname=sendmock-beta-bin\npkgver=1.3.0beta2\n",
    );
    expect(pkgbuild).toContain("conflicts=('sendmock' 'sendmock-bin')");
    expect(toPacmanVersion("1.3.0")).toBe("1.3.0");
  });
});

describe("COPR spec", () => {
  test("DS-03.5 the spec repackages the archive for its architecture", () => {
    const spec = buildCoprSpec("1.2.0", "2026-11-06");

    expect(spec).toContain("Version:        1.2.0\n");
    expect(spec).toContain(
      "Source0:        https://github.com/shibbirweb/sendmock/releases/download/v%{version}/sendmock-x86_64-unknown-linux-musl.tar.gz",
    );
    expect(spec).toContain("%ifarch aarch64\ntar -xzf %{SOURCE1}\n%endif");
    expect(spec).toContain(
      "* Fri Nov 06 2026 MD. Shibbir Ahmed <shibbirweb@gmail.com> - 1.2.0-1",
    );
  });

  test("refuses a date that is not YYYY-MM-DD", () => {
    expect(formatRpmChangelogDate("2026-01-04")).toBe("Sun Jan 04 2026");
    expect(() => formatRpmChangelogDate("06/11/2026")).toThrow();
  });
});

describe("Nix package", () => {
  test("DS-03.5 package.nix installs the binary for the four Nix systems with SRI hashes", () => {
    const packageNix = buildNixPackage("1.2.0", checksums);

    expect(packageNix).toContain('version = "1.2.0";');
    expect(packageNix).toContain(
      `x86_64-linux = {\n      target = "x86_64-unknown-linux-musl";\n      hash = "${toSriHash(hexChecksum)}";`,
    );
    expect(packageNix).toContain(
      'url = "https://github.com/shibbirweb/sendmock/releases/download/v${version}/sendmock-${source.target}.tar.gz";',
    );
    expect(packageNix).toContain('mainProgram = "sendmock";');
  });

  test("writes SHA256 checksums as Nix's SRI hashes", () => {
    expect(toSriHash("00".repeat(32))).toBe(
      "sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
    );
    expect(() => toSriHash("xyz")).toThrow();
  });
});
