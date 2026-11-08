#!/bin/sh
# Release test for our APT and YUM repository (DS-03.3): a repository signed with a throwaway
# key is built from the tested packages and served locally; in Debian the install page's apt
# steps install `sendmock`, and in Fedora its dnf steps do; then the repository gets a newer
# package and `apt upgrade` and `dnf upgrade` move to it.
#
#   sh scripts/release-tests/package-repository-test.sh <packages folder> <newer packages folder>
#
# Both folders hold this architecture's .deb and .rpm; the newer one is the same binary
# packaged as version 99.0.0.
set -eu

# AC: DS-03.3

packages_directory="$(cd "$1" && pwd)"
newer_packages_directory="$(cd "$2" && pwd)"
repository_root="$(cd "$(dirname "$0")/../.." && pwd)"
work_directory="$(mktemp -d)"
server_port=8765
base_url="http://127.0.0.1:$server_port/packages"
debian_container="sendmock-apt-test-$$"
fedora_container="sendmock-dnf-test-$$"

cleanup() {
  docker rm -f "$debian_container" "$fedora_container" > /dev/null 2>&1 || true
  [ -n "${server_pid:-}" ] && kill "$server_pid" 2>/dev/null || true
  rm -rf "$work_directory"
}
trap cleanup EXIT

fail() {
  echo "FAIL: $1" >&2
  exit 1
}

export GNUPGHOME="$work_directory/gnupg"
mkdir -m 700 "$GNUPGHOME"
gpg --batch --passphrase '' --quick-gen-key "SendMock test repository <test@example.test>" ed25519 sign never 2> /dev/null

build_repository() {
  rm -rf "$work_directory/site/packages" "$work_directory/channels"
  mkdir -p "$work_directory/channels/stable" "$work_directory/channels/beta" "$work_directory/site"
  cp "$1"/*.deb "$1"/*.rpm "$work_directory/channels/stable/"
  cp "$1"/*.deb "$1"/*.rpm "$work_directory/channels/beta/"
  sh "$repository_root/scripts/release/package-repository.sh" "$work_directory/channels" "$work_directory/site/packages" "$base_url"
}

build_repository "$packages_directory"
python3 -m http.server "$server_port" --bind 127.0.0.1 --directory "$work_directory/site" > /dev/null 2>&1 &
server_pid=$!
sleep 1

docker run -d --name "$debian_container" --network host debian:stable-slim sleep 900 > /dev/null
docker run -d --name "$fedora_container" --network host fedora:42 sleep 900 > /dev/null

# The install page's apt steps, with the local address.
docker exec "$debian_container" sh -c "apt-get update -qq && apt-get install -y -qq curl ca-certificates > /dev/null"
docker exec "$debian_container" sh -c "
  set -e
  install -d -m 0755 /etc/apt/keyrings
  curl -fsSL $base_url/sendmock.gpg -o /etc/apt/keyrings/sendmock.gpg
  echo 'deb [signed-by=/etc/apt/keyrings/sendmock.gpg] $base_url/apt stable main' > /etc/apt/sources.list.d/sendmock.list
  apt-get update -qq
  apt-get install -y -qq sendmock > /dev/null
  sendmock version --json
" || fail "apt installs sendmock from the signed repository"
echo "PASS: apt installs sendmock from the signed repository"

# The install page's dnf steps, with the local address.
docker exec "$fedora_container" sh -c "
  set -e
  curl -fsSL $base_url/sendmock-stable.repo -o /etc/yum.repos.d/sendmock.repo
  dnf install -y -q sendmock > /dev/null
  sendmock version --json
" || fail "dnf installs sendmock from the signed repository"
echo "PASS: dnf installs sendmock from the signed repository"

build_repository "$newer_packages_directory"

upgraded_deb_version="$(docker exec "$debian_container" sh -c "apt-get update -qq && apt-get upgrade -y -qq > /dev/null && dpkg-query -W -f='\${Version}' sendmock")"
[ "$upgraded_deb_version" = "99.0.0" ] || fail "apt upgrade moves to the newer package (it has $upgraded_deb_version)"
echo "PASS: apt upgrade moves to the newer package"

upgraded_rpm_version="$(docker exec "$fedora_container" sh -c "dnf upgrade -y -q --refresh sendmock > /dev/null && rpm -q --qf '%{VERSION}' sendmock")"
[ "$upgraded_rpm_version" = "99.0.0" ] || fail "dnf upgrade moves to the newer package (it has $upgraded_rpm_version)"
echo "PASS: dnf upgrade moves to the newer package"
