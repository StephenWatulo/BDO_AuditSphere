#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

if [[ $# -lt 2 || $# -gt 3 ]]; then
  printf 'Usage: %s <domain> <acme-email> [release-tag]\n' "$0" >&2
  exit 2
fi

domain="$1"
acme_email="$2"
release_tag="${3:-$(date -u +%Y%m%d-%H%M)}"
[[ "$domain" =~ ^[A-Za-z0-9][A-Za-z0-9.-]*[A-Za-z0-9]$ ]] || { printf 'Invalid domain hostname.\n' >&2; exit 2; }
[[ "$acme_email" == *@*.* ]] || { printf 'Invalid ACME contact email.\n' >&2; exit 2; }

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
env_file="$script_dir/../.env.vm"
[[ ! -e "$env_file" ]] || { printf 'Refusing to overwrite existing %s\n' "$env_file" >&2; exit 1; }

base64url() { openssl rand -base64 48 | tr '+/' '-_' | tr -d '=\n'; }
demo_password="Demo-$(base64url)"

printf '%s\n' \
  'COMPOSE_PROJECT_NAME=auditsphere-live' \
  "RELEASE_TAG=$release_tag" \
  "DOMAIN=$domain" \
  "ACME_EMAIL=$acme_email" \
  'POSTGRES_USER=auditsphere' \
  "POSTGRES_PASSWORD=$(openssl rand -hex 24)" \
  'POSTGRES_DB=auditsphere' \
  "JWT_ACCESS_SECRET=$(base64url)" \
  "JWT_REFRESH_SECRET=$(base64url)" \
  "ENCRYPTION_KEY=$(openssl rand -hex 32)" \
  'S3_REGION=us-east-1' \
  'S3_BUCKET=auditsphere-documents' \
  "S3_ACCESS_KEY=auditsphere$(openssl rand -hex 5)" \
  "S3_SECRET_KEY=$(base64url)" \
  "DEMO_PASSWORD=$demo_password" \
  'AI_BASE_URL=https://api.openai.com/v1' \
  'AI_MODEL=gpt-4o' \
  'ENTRA_TENANT_ID=' \
  'ENTRA_CLIENT_ID=' \
  'ENTRA_CLIENT_SECRET=' \
  'SMTP_HOST=' \
  'SMTP_PORT=587' \
  'SMTP_USER=' \
  'SMTP_PASS=' \
  'SMTP_FROM=BDO AuditSphere <no-reply@auditsphere.local>' \
  'BACKUP_ROOT=/opt/auditsphere/backups' \
  'BACKUP_RETENTION_DAYS=14' > "$env_file"

chmod 600 "$env_file"
printf 'Created %s with mode 600. The DEMO_PASSWORD inside it is the presentation login password.\n' "$env_file"
