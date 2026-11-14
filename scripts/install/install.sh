#!/bin/sh
# Installs SendMock on macOS and Linux (docs/wiki/install.md, Install script).
#
#   curl -fsSL https://github.com/shibbirweb/sendmock/releases/latest/download/install.sh | sh
#   curl -fsSL https://github.com/shibbirweb/sendmock/releases/download/beta/install.sh | sh -s -- --channel beta
#
# Downloads the archive for this system from the GitHub release of the chosen channel, checks it
# against the release's SHA256SUMS, puts `sendmock` in the install folder and, when that folder is
# not on PATH yet, adds it to the shell's profile so a new terminal finds it.

set -eu

releases_url="${SENDMOCK_RELEASES_URL:-https://github.com/shibbirweb/sendmock/releases}"
channel="${SENDMOCK_CHANNEL:-stable}"
install_directory="${SENDMOCK_INSTALL_DIR:-$HOME/.local/bin}"
should_modify_path=1

print_usage() {
  cat <<'USAGE'
Installs SendMock.

Usage: install.sh [--channel stable|beta] [--install-dir <folder>] [--no-modify-path]

  --channel <stable|beta>  the release channel (default stable, or SENDMOCK_CHANNEL)
  --install-dir <folder>   where sendmock goes (default ~/.local/bin, or SENDMOCK_INSTALL_DIR)
  --no-modify-path         do not add the folder to your shell profile
  --help                   show this help
USAGE
}

fail() {
  echo "sendmock install: $1" >&2
  exit 1
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --channel)
      [ "$#" -ge 2 ] || fail "--channel needs a value: stable or beta"
      channel="$2"
      shift 2
      ;;
    --channel=*)
      channel="${1#--channel=}"
      shift
      ;;
    --install-dir)
      [ "$#" -ge 2 ] || fail "--install-dir needs a folder"
      install_directory="$2"
      shift 2
      ;;
    --install-dir=*)
      install_directory="${1#--install-dir=}"
      shift
      ;;
    --no-modify-path)
      should_modify_path=0
      shift
      ;;
    --help | -h)
      print_usage
      exit 0
      ;;
    *)
      print_usage >&2
      fail "unknown option $1"
      ;;
  esac
done

case "$channel" in
  stable) download_url="$releases_url/latest/download" ;;
  beta) download_url="$releases_url/download/beta" ;;
  *) fail "unknown channel '$channel': use stable or beta" ;;
esac

detect_target() {
  operating_system="$(uname -s)"
  cpu="$(uname -m)"
  case "$operating_system" in
    Darwin) os_part="apple-darwin" ;;
    Linux) os_part="unknown-linux-musl" ;;
    *) fail "this script supports macOS and Linux (found $operating_system); on Windows use install.ps1" ;;
  esac
  case "$cpu" in
    x86_64 | amd64) cpu_part="x86_64" ;;
    arm64 | aarch64) cpu_part="aarch64" ;;
    *) fail "no SendMock build for the $cpu CPU: builds exist for x86_64 and arm64 (aarch64)" ;;
  esac
  echo "$cpu_part-$os_part"
}

download_file() {
  source_url="$1"
  destination_path="$2"
  case "$source_url" in
    file://*)
      cp "${source_url#file://}" "$destination_path" 2>/dev/null || fail "could not read $source_url"
      return
      ;;
  esac
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL --retry 3 -o "$destination_path" "$source_url" || fail "could not download $source_url"
  elif command -v wget >/dev/null 2>&1; then
    wget -q -O "$destination_path" "$source_url" || fail "could not download $source_url"
  else
    fail "curl or wget is needed to download SendMock"
  fi
}

compute_sha256() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | cut -d ' ' -f 1
  elif command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$1" | cut -d ' ' -f 1
  else
    fail "sha256sum or shasum is needed to check the download"
  fi
}

verify_checksum() {
  archive_path="$1"
  archive_name="$2"
  checksums_path="$3"
  expected_checksum="$(awk -v name="$archive_name" '$2 == name || $2 == "*" name { print $1 }' "$checksums_path")"
  [ -n "$expected_checksum" ] || fail "SHA256SUMS has no line for $archive_name"
  actual_checksum="$(compute_sha256 "$archive_path")"
  [ "$actual_checksum" = "$expected_checksum" ] || fail "the checksum of $archive_name does not match SHA256SUMS; nothing was installed"
}

profile_file_for_shell() {
  case "$(basename "${SHELL:-sh}")" in
    zsh) echo "${ZDOTDIR:-$HOME}/.zshrc" ;;
    bash) echo "$HOME/.bashrc" ;;
    fish) echo "$HOME/.config/fish/conf.d/sendmock.fish" ;;
    *) echo "$HOME/.profile" ;;
  esac
}

add_to_path() {
  case ":$PATH:" in
    *":$install_directory:"*) return ;;
  esac
  if [ "$should_modify_path" -eq 0 ]; then
    echo "Add $install_directory to your PATH to run sendmock."
    return
  fi
  profile_path="$(profile_file_for_shell)"
  path_marker="# Added by the SendMock installer"
  if [ -f "$profile_path" ] && grep -qF "$path_marker" "$profile_path"; then
    return
  fi
  mkdir -p "$(dirname "$profile_path")"
  case "$profile_path" in
    *.fish) path_line="fish_add_path \"$install_directory\"" ;;
    *) path_line="export PATH=\"$install_directory:\$PATH\"" ;;
  esac
  printf '\n%s\n%s\n' "$path_marker" "$path_line" >>"$profile_path"
  echo "Added $install_directory to PATH in $profile_path; open a new terminal to use it."
}

main() {
  target="$(detect_target)"
  archive_name="sendmock-$target.tar.gz"
  work_directory="$(mktemp -d)"
  trap 'rm -rf "$work_directory"' EXIT

  echo "Downloading SendMock ($channel) for $target..."
  download_file "$download_url/$archive_name" "$work_directory/$archive_name"
  download_file "$download_url/SHA256SUMS" "$work_directory/SHA256SUMS"
  verify_checksum "$work_directory/$archive_name" "$archive_name" "$work_directory/SHA256SUMS"

  mkdir -p "$work_directory/extracted"
  tar -xzf "$work_directory/$archive_name" -C "$work_directory/extracted"
  [ -f "$work_directory/extracted/sendmock" ] || fail "the archive holds no sendmock binary"

  mkdir -p "$install_directory"
  chmod 755 "$work_directory/extracted/sendmock"
  mv -f "$work_directory/extracted/sendmock" "$install_directory/sendmock"
  echo "Installed $("$install_directory/sendmock" --version 2>/dev/null || echo sendmock) to $install_directory/sendmock"

  add_to_path
  echo "Run: sendmock"
}

main
