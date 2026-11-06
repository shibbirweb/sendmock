#!/usr/bin/env bash
# Checks the published image after the tags are pushed (DS-02.4, DS-02.5): every tag points at
# the signed manifest, the signature is this repository's docker-edge workflow (keyless, GitHub
# OIDC), both platforms carry an SBOM and provenance, and each platform is under 25 MB
# compressed in the registry.
#
#     scripts/docker-published-check.sh <image> <manifest digest> "<tags>" <tag suffix>
set -euo pipefail

image="$1"
manifest_digest="$2"
image_tags="$3"
tag_suffix="${4:-}"
maximum_compressed_bytes=26214400

fail() {
  echo "Failed: $1" >&2
  exit 1
}

pass() {
  echo "ok   $1"
}

for image_tag in $image_tags; do
  tag_digest="$(docker buildx imagetools inspect "$image:$image_tag$tag_suffix" --format '{{json .Manifest}}' | jq -r .digest)"
  [ "$tag_digest" = "$manifest_digest" ] || fail "$image:$image_tag$tag_suffix points at $manifest_digest (it points at $tag_digest)"
done
# shellcheck disable=SC2086 # the tags are space-separated on purpose
pass "every tag points at $manifest_digest: $(printf "%s$tag_suffix " $image_tags)"

cosign verify "$image@$manifest_digest" \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com \
  --certificate-identity-regexp '^https://github\.com/shibbirweb/sendmock/\.github/workflows/docker-edge\.yml@' \
  > /dev/null || fail "the image is signed by the docker-edge workflow"
pass "cosign verify: signed by the docker-edge workflow through GitHub OIDC"

image_index="$(docker buildx imagetools inspect "$image@$manifest_digest" --raw)"
platform_digests="$(echo "$image_index" | jq -r '.manifests[] | select(.platform.os == "linux") | .digest')"
attestation_count="$(echo "$image_index" | jq '[.manifests[] | select(.annotations["vnd.docker.reference.type"] == "attestation-manifest")] | length')"
[ "$(echo "$platform_digests" | wc -l | tr -d ' ')" = "2" ] || fail "the index holds linux/amd64 and linux/arm64"
[ "$attestation_count" = "2" ] || fail "each platform has an attestation manifest (found $attestation_count)"
for platform in linux/amd64 linux/arm64; do
  sbom_format="$(docker buildx imagetools inspect "$image@$manifest_digest" --format "{{ json (index .SBOM \"$platform\") }}" | jq -r '.SPDX.spdxVersion // empty')"
  [ -n "$sbom_format" ] || fail "$platform carries an SPDX SBOM"
  provenance_type="$(docker buildx imagetools inspect "$image@$manifest_digest" --format "{{ json (index .Provenance \"$platform\") }}" | jq -r '.SLSA.buildType // .SLSA.buildDefinition.buildType // empty')"
  [ -n "$provenance_type" ] || fail "$platform carries SLSA provenance"
  pass "$platform carries an SBOM ($sbom_format) and provenance"
done

for platform_digest in $platform_digests; do
  compressed_bytes="$(docker buildx imagetools inspect "$image@$platform_digest" --raw | jq '[.layers[].size] + [.config.size] | add')"
  [ "$compressed_bytes" -lt "$maximum_compressed_bytes" ] || fail "$platform_digest is under 25 MB compressed ($compressed_bytes bytes)"
  pass "$platform_digest is $((compressed_bytes / 1024 / 1024)) MB compressed in the registry, under 25 MB"
done
