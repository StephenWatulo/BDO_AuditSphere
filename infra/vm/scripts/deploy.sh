#!/usr/bin/env bash
set -Eeuo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
project_root="$(cd "$script_dir/../../.." && pwd)"
env_file="${AUDITSPHERE_ENV_FILE:-$project_root/infra/vm/.env.vm}"
compose_file="$project_root/infra/vm/compose.yml"
compose=(docker compose --env-file "$env_file" -f "$compose_file")
value() { sed -n "s/^$1=//p" "$env_file" | tail -n 1; }

"$script_dir/preflight.sh"

if [[ -n "$("${compose[@]}" ps -q api 2>/dev/null)" ]]; then
  printf 'Existing deployment detected; creating a pre-deploy backup.\n'
  "$script_dir/backup.sh"
fi

printf 'Pulling third-party images...\n'
"${compose[@]}" pull postgres minio minio-init clamav caddy

printf 'Building versioned AuditSphere images...\n'
"${compose[@]}" build --pull api web

printf 'Starting the stack. ClamAV signature initialization can take several minutes...\n'
"${compose[@]}" up -d --remove-orphans

domain="$(value DOMAIN)"
for attempt in $(seq 1 180); do
  if curl --fail --silent --show-error --max-time 10 "https://$domain/api/v1/ready" >/dev/null 2>&1; then
    printf 'AuditSphere is ready at https://%s\n' "$domain"
    "${compose[@]}" ps
    exit 0
  fi
  if (( attempt % 12 == 0 )); then
    printf 'Still waiting for HTTPS and application readiness (%s/180)...\n' "$attempt"
    "${compose[@]}" ps
  fi
  sleep 5
done

printf 'Deployment did not become ready within 15 minutes. Recent logs follow.\n' >&2
"${compose[@]}" logs --tail 200 caddy clamav api web >&2
exit 1
