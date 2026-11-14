#!/bin/sh
# Release test case 9 on macOS and Linux (docs/plan/09-distribution.md, Binary tests on every
# platform): install.sh installs the stable and, with --channel beta, the beta from release
# folders holding the tested archive, and a new shell finds `sendmock` on its PATH (DS-01.5).
#
#   sh scripts/release-tests/install-script.sh <archive> <version> <channel>

set -eu

archive_path="$1"
expected_version="$2"
expected_channel="$3"
repository_root="$(cd "$(dirname "$0")/../.." && pwd)"
work_directory="$(mktemp -d)"
trap 'rm -rf "$work_directory"' EXIT

for release_folder in latest/download download/beta; do
  mkdir -p "$work_directory/releases/$release_folder"
  cp "$archive_path" "$work_directory/releases/$release_folder/"
  cp "$archive_path.sha256" "$work_directory/releases/$release_folder/SHA256SUMS"
done

case "$(uname -s)" in
  Darwin) user_shell=/bin/zsh profile_name=.zshrc ;;
  *) user_shell=/bin/bash profile_name=.bashrc ;;
esac

for channel_option in "" "--channel beta"; do
  home_directory="$work_directory/home${channel_option:+-beta}"
  mkdir -p "$home_directory"
  # shellcheck disable=SC2086 # the option is two words on purpose
  env HOME="$home_directory" SHELL="$user_shell" PATH="/usr/bin:/bin:/usr/sbin:/sbin" \
    SENDMOCK_RELEASES_URL="file://$work_directory/releases" \
    sh "$repository_root/scripts/install/install.sh" $channel_option

  version_json="$(env -i HOME="$home_directory" "$user_shell" -ic "sendmock version --json" 2>/dev/null)"
  echo "$version_json"
  case "$version_json" in
    *"\"version\":\"$expected_version\""*"\"channel\":\"$expected_channel\""* | \
      *"\"channel\":\"$expected_channel\""*"\"version\":\"$expected_version\""*) ;;
    *)
      echo "FAIL: a new shell after install.sh ${channel_option:-(stable)} does not run sendmock $expected_version ($expected_channel)" >&2
      exit 1
      ;;
  esac
  [ -f "$home_directory/$profile_name" ] || {
    echo "FAIL: install.sh did not add the folder to $profile_name" >&2
    exit 1
  }
  echo "PASS: install.sh ${channel_option:-(stable)} leaves sendmock on the PATH of a new shell"
done
