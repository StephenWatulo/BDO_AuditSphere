#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
project_root="$(cd "$script_dir/../../.." && pwd)"
env_file="${AUDITSPHERE_ENV_FILE:-$project_root/infra/vm/.env.vm}"
compose_file="$project_root/infra/vm/compose.yml"
value() { sed -n "s/^$1=//p" "$env_file" | tail -n 1; }

backup_root="$(value BACKUP_ROOT)"
retention_days="$(value BACKUP_RETENTION_DAYS)"
db_user="$(value POSTGRES_USER)"
db_name="$(value POSTGRES_DB)"
[[ "$backup_root" == /opt/auditsphere/backups* ]] || { printf 'BACKUP_ROOT must remain under /opt/auditsphere/backups.\n' >&2; exit 1; }
[[ "$retention_days" =~ ^[0-9]+$ ]] || { printf 'BACKUP_RETENTION_DAYS must be a number.\n' >&2; exit 1; }

stamp="$(date -u +%Y%m%dT%H%M%SZ)"
destination="$backup_root/$stamp"
mkdir -p "$destination"

compose=(docker compose --env-file "$env_file" -f "$compose_file")
"${compose[@]}" exec -T postgres pg_dump --username "$db_user" --dbname "$db_name" --format custom > "$destination/database.dump"

docker run --rm \
  --volume auditsphere-minio-data:/source:ro \
  --volume "$destination:/backup" \
  alpine:3.22 tar -C /source -czf /backup/minio-data.tar.gz .

docker run --rm \
  --volume auditsphere-caddy-data:/source:ro \
  --volume "$destination:/backup" \
  alpine:3.22 tar -C /source -czf /backup/caddy-data.tar.gz .

cp "$compose_file" "$project_root/infra/vm/Caddyfile" "$destination/"
(
  cd "$destination"
  sha256sum database.dump minio-data.tar.gz caddy-data.tar.gz compose.yml Caddyfile > SHA256SUMS
)

find "$backup_root" -mindepth 1 -maxdepth 1 -type d -mtime "+$retention_days" -print -exec rm -rf -- {} +
printf 'Backup completed: %s\n' "$destination"
