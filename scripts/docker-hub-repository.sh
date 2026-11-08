#!/usr/bin/env bash
# Makes sure the Docker Hub repository exists and is public before the image is pushed there
# (DS-02), and gives it its overview page. A push would create it with the account's default
# visibility, and a private repository breaks `docker pull` for everyone, so this creates it
# public, or stops the job when it exists but is private.
#
#     scripts/docker-hub-repository.sh <namespace>/<name> <readme file>
#
# Needs DOCKERHUB_USERNAME and DOCKERHUB_TOKEN (a personal access token with read and write).
# Both image variants run it at once, so a create that loses the race is fine as long as the
# repository is then readable and public.
set -euo pipefail

repository="$1"
readme_path="$2"
short_description="Catch the email, SMS, push notifications, payments and webhooks your app sends."
namespace="${repository%%/*}"
repository_name="${repository#*/}"
hub_api="https://hub.docker.com/v2"
repository_file="$(mktemp)"

hub_token="$(
  jq -n --arg username "$DOCKERHUB_USERNAME" --arg password "$DOCKERHUB_TOKEN" \
    '{username: $username, password: $password}' |
    curl -fsS -H "Content-Type: application/json" -d @- "$hub_api/users/login" | jq -r .token
)"

read_repository() {
  curl -sS -o "$repository_file" -w "%{http_code}" \
    -H "Authorization: Bearer $hub_token" "$hub_api/repositories/$namespace/$repository_name/"
}

if [ "$(read_repository)" = "404" ]; then
  jq -n --arg namespace "$namespace" --arg name "$repository_name" \
    --arg description "$short_description" \
    '{namespace: $namespace, name: $name, is_private: false, description: $description}' |
    curl -sS -o /dev/null -H "Authorization: Bearer $hub_token" -H "Content-Type: application/json" \
      -d @- "$hub_api/repositories/" || true
fi

read_status="$(read_repository)"
if [ "$read_status" != "200" ]; then
  echo "::error title=Docker Hub::$repository could not be read or created (HTTP $read_status); check that DOCKERHUB_TOKEN has read and write access"
  exit 1
fi
if [ "$(jq -r .is_private "$repository_file")" != "false" ]; then
  echo "::error title=Docker Hub::$repository is private; make it public in its settings on hub.docker.com, then run the job again"
  exit 1
fi
echo "Docker Hub repository $repository is public"

# The overview page follows the README in the repository on every push, so it never goes stale.
# A failed update leaves the old page and is not worth stopping the image for.
update_status="$(
  jq -n --arg description "$short_description" --rawfile full_description "$readme_path" \
    '{description: $description, full_description: $full_description}' |
    curl -sS -o /dev/null -w "%{http_code}" -X PATCH -H "Authorization: Bearer $hub_token" \
      -H "Content-Type: application/json" -d @- "$hub_api/repositories/$namespace/$repository_name/"
)"
if [ "$update_status" = "200" ]; then
  echo "Docker Hub overview updated from $readme_path"
else
  echo "::warning title=Docker Hub::the overview of $repository was not updated (HTTP $update_status)"
fi
