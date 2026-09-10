#!/usr/bin/env bash
set -Eeuo pipefail

if [[ "${1:-}" != "--confirm-synthetic-presentation-data" ]]; then
  printf 'Refusing to seed. This command creates synthetic demo users with a shared known password.\n' >&2
  printf 'For the isolated presentation environment only, rerun with:\n' >&2
  printf '  %s --confirm-synthetic-presentation-data\n' "$0" >&2
  exit 2
fi

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
project_root="$(cd "$script_dir/../../.." && pwd)"
env_file="${AUDITSPHERE_ENV_FILE:-$project_root/infra/vm/.env.vm}"
compose_file="$project_root/infra/vm/compose.yml"

docker compose --env-file "$env_file" -f "$compose_file" --profile tools run --rm demo-seed
printf 'Synthetic presentation data loaded. Do not use these accounts with real client data.\n'
