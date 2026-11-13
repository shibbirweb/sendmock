import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const installPage = readFileSync("docs/wiki/install.md", "utf8");
const repositoryTest = readFileSync(
  "scripts/release-tests/package-repository-test.sh",
  "utf8",
);
const repositoryScript = readFileSync(
  "scripts/release/package-repository.sh",
  "utf8",
);
const publishedBaseUrl = "https://shibbirweb.github.io/sendmock/packages";
/**
 * apt reads its source from the site's custom domain: the github.io address redirects there
 * over plain http, and apt refuses a redirect from https to http (dnf and curl follow it).
 */
const aptSourceBaseUrl = "https://shibbir.me/sendmock/packages";

describe("APT and YUM repository", () => {
  test("DS-03.3 the install page's apt steps are the ones the release test runs", () => {
    for (const suite of ["stable", "beta"]) {
      expect(installPage).toContain(
        `deb [signed-by=/etc/apt/keyrings/sendmock.gpg] ${aptSourceBaseUrl}/apt ${suite} main`,
      );
    }
    expect(installPage).toContain(
      `curl -fsSL ${publishedBaseUrl}/sendmock.gpg | sudo tee /etc/apt/keyrings/sendmock.gpg`,
    );
    expect(repositoryTest).toContain(
      "deb [signed-by=/etc/apt/keyrings/sendmock.gpg] $base_url/apt stable main",
    );
    expect(repositoryTest).toContain("$base_url/sendmock.gpg");
  });

  test("DS-03.3 the install page's dnf steps fetch the .repo files the repository writes", () => {
    for (const suite of ["stable", "beta"]) {
      expect(installPage).toContain(
        `sudo curl -fsSL -o /etc/yum.repos.d/sendmock.repo ${publishedBaseUrl}/sendmock-${suite}.repo`,
      );
    }
    expect(repositoryScript).toContain(
      '"$output_directory/sendmock-$suite.repo"',
    );
    expect(repositoryTest).toContain("$base_url/sendmock-stable.repo");
  });

  test("DS-03.3 the repository signs its apt and dnf metadata", () => {
    expect(repositoryScript).toContain("--clearsign");
    expect(repositoryScript).toContain("repomd.xml.asc");
    expect(repositoryScript).toContain("repo_gpgcheck=1");
  });
});
