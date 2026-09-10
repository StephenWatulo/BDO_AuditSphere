#!/usr/bin/env bash
set -Eeuo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
project_root="$(cd "$script_dir/../../.." && pwd)"
env_file="${AUDITSPHERE_ENV_FILE:-$project_root/infra/vm/.env.vm}"
compose_file="$project_root/infra/vm/compose.yml"

fail() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }
value() { sed -n "s/^$1=//p" "$env_file" | tail -n 1; }

[[ -f "$env_file" ]] || fail "Missing $env_file. Copy .env.vm.example to .env.vm and fill it in."
[[ "$(stat -c '%a' "$env_file")" == "600" ]] || fail "$env_file must have mode 600 (run chmod 600 '$env_file')."

for command in docker curl getent awk sed grep openssl; do
  command -v "$command" >/dev/null 2>&1 || fail "Required command not found: $command"
done

docker info >/dev/null 2>&1 || fail "Docker Engine is not running or this user cannot access it."
docker compose version >/dev/null 2>&1 || fail "Docker Compose v2 is required."

if grep -Eq '(^|=)(CHANGE_ME|auditsphere\.example\.com|platform-owner@example\.com)' "$env_file"; then
  fail "One or more placeholder values remain in $env_file."
fi

domain="$(value DOMAIN)"
[[ "$domain" =~ ^[A-Za-z0-9][A-Za-z0-9.-]*[A-Za-z0-9]$ ]] || fail "DOMAIN must be a DNS hostname without scheme or path."
[[ "$(value JWT_ACCESS_SECRET)" != "$(value JWT_REFRESH_SECRET)" ]] || fail "JWT access and refresh secrets must be different."
[[ ${#domain} -le 253 ]] || fail "DOMAIN is too long."
[[ $(value ENCRYPTION_KEY) =~ ^[0-9a-fA-F]{64}$ ]] || fail "ENCRYPTION_KEY must be exactly 64 hexadecimal characters."
[[ ${#$(value POSTGRES_PASSWORD)} -ge 32 ]] || fail "POSTGRES_PASSWORD must contain at least 32 characters."
[[ ${#$(value JWT_ACCESS_SECRET)} -ge 43 ]] || fail "JWT_ACCESS_SECRET is too short."
[[ ${#$(value JWT_REFRESH_SECRET)} -ge 43 ]] || fail "JWT_REFRESH_SECRET is too short."
[[ ${#$(value S3_SECRET_KEY)} -ge 32 ]] || fail "S3_SECRET_KEY is too short."

available_kb="$(df -Pk "$project_root" | awk 'NR==2 {print $4}')"
[[ "$available_kb" -ge 20971520 ]] || fail "At least 20 GB of free disk is required before building."
memory_kb="$(awk '/MemTotal/ {print $2}' /proc/meminfo)"
[[ "$memory_kb" -ge 7864320 ]] || fail "At least 8 GB RAM is required; 12 GB is recommended because ClamAV needs about 4 GB."

getent ahostsv4 "$domain" >/dev/null 2>&1 || fail "DOMAIN does not resolve to an IPv4 address yet. Create the DNS A record first."

docker compose --env-file "$env_file" -f "$compose_file" config --quiet
printf 'Preflight checks passed for %s.\n' "$domain"
