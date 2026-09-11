import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const failures = [];
const windowsInstaller = read('infra/windows/scripts/Install-Services.ps1');
if (/\/inheritance:r[^\r\n]*\/T\b/.test(windowsInstaller)) {
  failures.push('Windows installer must not recursively disable inheritance on child files');
}
const required = [
  'infra/windows/production.env.example',
  'infra/windows/backup.env.example',
  'infra/windows/Caddyfile',
  'infra/windows/scripts/Import-Environment.ps1',
  'infra/windows/scripts/Run-Service.ps1',
  'infra/windows/scripts/Initialize-ProductionEnvironment.ps1',
  'infra/windows/scripts/Preflight.ps1',
  'infra/windows/scripts/Initialize-Database.ps1',
  'infra/windows/scripts/Build-Release.ps1',
  'infra/windows/scripts/Install-Services.ps1',
  'infra/windows/scripts/Invoke-DatabaseMigration.ps1',
  'infra/windows/scripts/New-BootstrapAdministrator.ps1',
  'infra/windows/scripts/Start-Services.ps1',
  'infra/windows/scripts/Test-Deployment.ps1',
  'infra/windows/scripts/Backup-AuditSphere.ps1',
  'infra/windows/scripts/Restore-AuditSphere.ps1',
  'infra/windows/services/AuditSphere.Api.xml',
  'infra/windows/services/AuditSphere.Worker.xml',
  'infra/windows/services/AuditSphere.Web.xml',
  'infra/windows/services/AuditSphere.Caddy.xml',
  'PRODUCTION_DEPLOYMENT_GUIDE_WINDOWS.md',
  'PRODUCTION_READINESS_CHECKLIST.md',
  'FUNCTIONAL_SCOPE_AND_LIMITATIONS.md',
  'INCIDENT_AND_RECOVERY_RUNBOOK.md',
];

for (const file of required) if (!fs.existsSync(path.join(root, file))) failures.push(`missing ${file}`);
const env = read('infra/windows/production.env.example');
const serviceRunner = read('infra/windows/scripts/Run-Service.ps1');
 
if (serviceRunner.includes('pnpm.cmd')) {
  failures.push('Windows services must not invoke pnpm or Corepack at runtime.');
}
 
for (const expectation of [
  'Get-Command node.exe -ErrorAction Stop',
  "apps\\api\\dist\\main.js",
  '--worker',
  "-H '127.0.0.1'",
  "-p '3000'",
  "node_modules\\next\\dist\\bin\\next",
]) {
  if (!serviceRunner.includes(expectation)) {
    failures.push(`Windows service runner lacks ${expectation}`);
  }
}
const backupEnv = read('infra/windows/backup.env.example');
for (const expectation of [
  'NODE_ENV=production',
  'API_HOST=127.0.0.1',
  'COOKIE_SECURE=true',
  'MFA_ENFORCEMENT=all',
  'MALWARE_SCAN_REQUIRED=true',
  'MALWARE_SCANNER=defender',
  'SWAGGER_ENABLED=false',
  'STORAGE_DRIVER=local',
]) if (!env.includes(expectation)) failures.push(`environment template lacks ${expectation}`);
if (!/^BACKUP_ROOT=\\\\/m.test(env)) failures.push('backup target must be an off-server UNC path');
if (!/^BACKUP_DATABASE_URL=postgresql:\/\/auditsphere_backup:/m.test(backupEnv)) failures.push('backup must use its separate database role');
if (!/Strict-Transport-Security/.test(read('infra/windows/Caddyfile'))) failures.push('Caddy must send HSTS');
if (fs.existsSync(path.join(root, 'infra/windows/production.env'))) failures.push('real production.env must not be packaged');

for (const name of fs.readdirSync(path.join(root, 'infra/windows/services')).filter((item) => item.endsWith('.xml'))) {
  const xml = read(`infra/windows/services/${name}`);
  for (const placeholder of ['__RUNNER__', '__APP_ROOT__', '__ENV_FILE__', '__RUNTIME_ROOT__', '__LOG_ROOT__']) {
    if (!xml.includes(placeholder)) failures.push(`${name} lacks installer placeholder ${placeholder}`);
  }
  if (!xml.includes('NT AUTHORITY\\LocalService')) failures.push(`${name} must not run as LocalSystem`);
}

for (const name of fs.readdirSync(path.join(root, 'infra/windows/scripts')).filter((item) => item.endsWith('.ps1'))) {
  const source = read(`infra/windows/scripts/${name}`);
  if (!source.includes("$ErrorActionPreference = 'Stop'")) failures.push(`${name} must fail closed`);
  const open = (source.match(/\{/g) ?? []).length;
  const close = (source.match(/\}/g) ?? []).length;
  if (open !== close) failures.push(`${name} has unbalanced braces`);
}

if (failures.length) {
  console.error(failures.map((failure) => `- ${failure}`).join('\n'));
  process.exit(1);
}
console.log('Windows Server deployment safeguards verified.');
