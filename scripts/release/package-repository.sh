#!/bin/sh
# Builds our signed APT and YUM repository (DS-03.3, plan 30 W4) from release packages:
#
#   sh scripts/release/package-repository.sh <packages folder> <output folder> <base URL>
#
# The packages folder holds `stable/` and `beta/`, each with that channel's .deb and .rpm
# files (a channel with no files is left out). The output is the `/packages/` folder of the
# website:
#
#   apt/dists/<stable|beta>/   Release, InRelease and Release.gpg, main/binary-<amd64|arm64>/
#   apt/pool/<stable|beta>/    the .deb files
#   rpm/<stable|beta>/         the .rpm files and repodata/ with repomd.xml.asc
#   sendmock.gpg, sendmock.asc the public key, binary for apt and armored for dnf
#   sendmock-<stable|beta>.repo the dnf repository files, pointing at <base URL>
#
# Signs with the first secret key in gpg's keyring (the workflow imports
# PACKAGES_GPG_PRIVATE_KEY first). Needs apt-ftparchive (apt-utils), createrepo_c and gpg.
set -eu

packages_directory="$1"
output_directory="$2"
base_url="${3%/}"

fail() {
  echo "package-repository: $1" >&2
  exit 1
}

for required_tool in apt-ftparchive createrepo_c gpg; do
  command -v "$required_tool" >/dev/null 2>&1 || fail "$required_tool is needed"
done
signing_key="$(gpg --batch --list-secret-keys --with-colons | awk -F: '$1 == "fpr" { print $10; exit }')"
[ -n "$signing_key" ] || fail "no secret key to sign with; import PACKAGES_GPG_PRIVATE_KEY first"

sign_clear() {
  gpg --batch --yes --local-user "$signing_key" --clearsign --output "$2" "$1"
}

sign_detached() {
  gpg --batch --yes --local-user "$signing_key" --armor --detach-sign --output "$2" "$1"
}

build_apt_suite() {
  suite="$1"
  apt_directory="$output_directory/apt"
  mkdir -p "$apt_directory/pool/$suite"
  cp "$packages_directory/$suite"/*.deb "$apt_directory/pool/$suite/"
  for architecture in amd64 arm64; do
    binary_directory="$apt_directory/dists/$suite/main/binary-$architecture"
    mkdir -p "$binary_directory"
    (cd "$apt_directory" && apt-ftparchive --arch "$architecture" packages "pool/$suite") > "$binary_directory/Packages"
    gzip -9 --keep --force "$binary_directory/Packages"
  done
  apt-ftparchive \
    -o "APT::FTPArchive::Release::Origin=SendMock" \
    -o "APT::FTPArchive::Release::Label=SendMock" \
    -o "APT::FTPArchive::Release::Suite=$suite" \
    -o "APT::FTPArchive::Release::Codename=$suite" \
    -o "APT::FTPArchive::Release::Architectures=amd64 arm64" \
    -o "APT::FTPArchive::Release::Components=main" \
    release "$apt_directory/dists/$suite" > "$apt_directory/dists/$suite/Release.unsigned"
  mv "$apt_directory/dists/$suite/Release.unsigned" "$apt_directory/dists/$suite/Release"
  sign_clear "$apt_directory/dists/$suite/Release" "$apt_directory/dists/$suite/InRelease"
  sign_detached "$apt_directory/dists/$suite/Release" "$apt_directory/dists/$suite/Release.gpg"
}

build_rpm_suite() {
  suite="$1"
  rpm_directory="$output_directory/rpm/$suite"
  mkdir -p "$rpm_directory"
  cp "$packages_directory/$suite"/*.rpm "$rpm_directory/"
  createrepo_c --quiet "$rpm_directory"
  sign_detached "$rpm_directory/repodata/repomd.xml" "$rpm_directory/repodata/repomd.xml.asc"
  cat > "$output_directory/sendmock-$suite.repo" <<REPO
[sendmock-$suite]
name=SendMock ($suite)
baseurl=$base_url/rpm/$suite
enabled=1
repo_gpgcheck=1
gpgcheck=0
gpgkey=$base_url/sendmock.asc
REPO
}

mkdir -p "$output_directory"
built_suites=""
for suite in stable beta; do
  if ls "$packages_directory/$suite"/*.deb >/dev/null 2>&1; then
    build_apt_suite "$suite"
    built_suites="$built_suites $suite(apt)"
  fi
  if ls "$packages_directory/$suite"/*.rpm >/dev/null 2>&1; then
    build_rpm_suite "$suite"
    built_suites="$built_suites $suite(rpm)"
  fi
done
[ -n "$built_suites" ] || fail "no .deb or .rpm files in $packages_directory/stable or $packages_directory/beta"

gpg --batch --yes --export "$signing_key" > "$output_directory/sendmock.gpg"
gpg --batch --yes --armor --export "$signing_key" > "$output_directory/sendmock.asc"
echo "Built the package repository:$built_suites, signed by $signing_key."
