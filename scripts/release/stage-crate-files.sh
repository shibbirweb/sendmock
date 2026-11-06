#!/bin/sh
# Copies the files two crates embed from outside their folders into them, so `cargo package`
# and `cargo publish` carry them (DS-03.1, cargo install): the UI build into
# crates/sendmock-api/web-dist and the agent skill into crates/sendmock-ops/skill. Their build.rs
# files use these copies only when the repository's folders are not there, as in a crate
# downloaded from crates.io. Run it after building the UI (web/dist).
set -eu

repository_root="$(cd "$(dirname "$0")/../.." && pwd)"
[ -f "$repository_root/web/dist/index.html" ] || {
  echo "web/dist is missing; build the UI first: cd web && bun run build" >&2
  exit 1
}
rm -rf "$repository_root/crates/sendmock-api/web-dist" "$repository_root/crates/sendmock-ops/skill"
cp -R "$repository_root/web/dist" "$repository_root/crates/sendmock-api/web-dist"
cp -R "$repository_root/skill/sendmock" "$repository_root/crates/sendmock-ops/skill"
echo "Staged web/dist and skill/sendmock into the crates."
