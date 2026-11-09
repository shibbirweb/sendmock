#!/usr/bin/env bun
/**
 * The RPM spec COPR builds for a stable release (DS-03.5): it repackages the release's static
 * Linux archive for x86_64 or aarch64, so COPR's Fedora builders compile nothing. Release build
 * makes the source RPM from it and sends it to the `shibbirweb/sendmock` COPR project.
 *
 *     bun scripts/release/copr-spec.ts <version> <release date, YYYY-MM-DD> [download URL]
 */
const repositoryUrl = "https://github.com/shibbirweb/sendmock";

const weekdayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const monthNames = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** RPM wants the changelog date as `Fri Nov 06 2026`. */
export function formatRpmChangelogDate(isoDate: string): string {
  const changelogDate = new Date(`${isoDate}T00:00:00Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(isoDate) ||
    Number.isNaN(changelogDate.getTime())
  ) {
    throw new Error(`${isoDate} is not a YYYY-MM-DD date`);
  }
  const dayOfMonth = String(changelogDate.getUTCDate()).padStart(2, "0");
  return `${weekdayNames[changelogDate.getUTCDay()]} ${monthNames[changelogDate.getUTCMonth()]} ${dayOfMonth} ${changelogDate.getUTCFullYear()}`;
}

/** RPM versions cannot hold `-`; `1.1.0~beta.1` sorts before `1.1.0`, as a beta should. */
export function toRpmVersion(version: string): string {
  return version.replace(/-beta\.(\d+)$/, "~beta.$1");
}

export function buildCoprSpec(
  version: string,
  releaseDate: string,
  downloadUrl = `${repositoryUrl}/releases/download/v${version}`,
): string {
  const rpmVersion = toRpmVersion(version);
  return `# Written by SendMock's Release build for ${version}; changes here are overwritten.
%global debug_package %{nil}

Name:           sendmock
Version:        ${rpmVersion}
Release:        1%{?dist}
Summary:        Catch email, SMS, payments and webhooks from any app on your machine
License:        MIT OR Apache-2.0
URL:            https://shibbirweb.github.io/sendmock/
Source0:        ${downloadUrl}/sendmock-x86_64-unknown-linux-musl.tar.gz
Source1:        ${downloadUrl}/sendmock-aarch64-unknown-linux-musl.tar.gz
ExclusiveArch:  x86_64 aarch64

%description
SendMock catches the email, SMS, payments and webhooks your app sends, on your machine, so
nothing reaches real people. It is one static binary with the web UI built in.

%prep
%setup -q -c -T
%ifarch x86_64
tar -xzf %{SOURCE0}
%endif
%ifarch aarch64
tar -xzf %{SOURCE1}
%endif

%install
install -Dm755 sendmock %{buildroot}%{_bindir}/sendmock

%files
%license LICENSE-MIT LICENSE-APACHE
%doc README.md
%{_bindir}/sendmock

%changelog
* ${formatRpmChangelogDate(releaseDate)} MD. Shibbir Ahmed <shibbirweb@gmail.com> - ${rpmVersion}-1
- SendMock ${version}: ${repositoryUrl}/releases/tag/v${version}
`;
}

if (import.meta.main) {
  const [version, releaseDate, downloadUrl] = process.argv.slice(2);
  if (!version || !releaseDate) {
    console.error(
      "Usage: bun scripts/release/copr-spec.ts <version> <release date, YYYY-MM-DD> [download URL]",
    );
    process.exit(2);
  }
  process.stdout.write(buildCoprSpec(version, releaseDate, downloadUrl));
}
