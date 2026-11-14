#!/bin/sh
# Copies the files two crates embed from outside their folders into them, so `cargo package`
# and `cargo publish` carry them (DS-03.1, cargo install): the UI build into
# crates/sendmock-api/web-dist and the agent skill into crates/sendmock-ops/skill. Their build.rs
# files use these copies only when the repository's folders are not there, as in a crate
# downloaded from crates.io. It also writes the release channel (the first argument, `stable`
# by default) into crates/sendmock/release-channel, which a build without
# SENDMOCK_RELEASE_CHANNEL reports. Run it after building the UI (web/dist).
#
#     sh scripts/release/stage-crate-files.sh [channel]
set -eu

release_channel="${1:-stable}"

repository_root="$(cd "$(dirname "$0")/../.." && pwd)"
[ -f "$repository_root/web/dist/index.html" ] || {
  echo "web/dist is missing; build the UI first: cd web && bun run build" >&2
  exit 1
}
rm -rf "$repository_root/crates/sendmock-api/web-dist" "$repository_root/crates/sendmock-ops/skill"
cp -R "$repository_root/web/dist" "$repository_root/crates/sendmock-api/web-dist"
cp -R "$repository_root/skill/sendmock" "$repository_root/crates/sendmock-ops/skill"
printf '%s\n' "$release_channel" > "$repository_root/crates/sendmock/release-channel"
echo "Staged web/dist, skill/sendmock and the $release_channel channel into the crates."
