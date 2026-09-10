#!/usr/bin/env bash
set -Eeuo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
project_root="$(cd "$script_dir/../../.." && pwd)"
env_file="${AUDITSPHERE_ENV_FILE:-$project_root/infra/vm/.env.vm}"
compose_file="$project_root/infra/vm/compose.yml"
value() { sed -n "s/^$1=//p" "$env_file" | tail -n 1; }
domain="$(value DOMAIN)"

printf 'Container status:\n'
docker compose --env-file "$env_file" -f "$compose_file" ps

redirect="$(curl --silent --output /dev/null --write-out '%{http_code} %{redirect_url}' "http://$domain/")"
[[ "$redirect" == 308* || "$redirect" == 301* ]] || { printf 'HTTP does not redirect to HTTPS: %s\n' "$redirect" >&2; exit 1; }

curl --fail --silent --show-error "https://$domain/api/v1/ready" | grep -q '"status":"ready"'
curl --fail --silent --show-error "https://$domain/sign-in" | grep -q 'BDO AuditSphere'
headers="$(curl --silent --show-error --head "https://$domain/sign-in" | tr -d '\r')"
grep -qi '^strict-transport-security:' <<<"$headers"
grep -qi '^x-content-type-options: nosniff' <<<"$headers"

printf 'Live verification passed for https://%s\n' "$domain"
