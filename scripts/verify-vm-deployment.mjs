import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const compose = read('infra/vm/compose.yml');
const caddy = read('infra/vm/Caddyfile');
const envExample = read('infra/vm/.env.vm.example');
const failures = [];

function serviceBlock(name) {
  const match = compose.match(new RegExp(`^  ${name}:\\n([\\s\\S]*?)(?=^  [a-z][a-z0-9-]*:|^networks:|^volumes:)`, 'm'));
  return match?.[1] ?? '';
}

for (const service of ['postgres', 'minio', 'clamav', 'api', 'worker', 'web']) {
  if (/^    ports:/m.test(serviceBlock(service))) failures.push(`${service} must not publish host ports`);
  if (!/^      - backend$/m.test(serviceBlock(service))) failures.push(`${service} must use the internal backend network`);
}
if (!/^    internal: true$/m.test(compose)) failures.push('backend network must be internal');
if (!/"80:80"/.test(serviceBlock('caddy')) || !/"443:443"/.test(serviceBlock('caddy'))) failures.push('Caddy must publish ports 80 and 443');
if (!/COOKIE_SECURE: "true"/.test(compose)) failures.push('secure cookies must be enabled');
if (!/MALWARE_SCAN_REQUIRED: "true"/.test(compose)) failures.push('malware scanning must fail closed');
if (!/AI_ENABLED: "false"/.test(compose)) failures.push('AI must be disabled in the presentation stack');
if (!/DEMO_PASSWORD: \$\{DEMO_PASSWORD\}/.test(compose)) failures.push('demo seed must use the private deployment password');
if (!/Strict-Transport-Security/.test(caddy)) failures.push('Caddy must send HSTS');
if (!/DEMO_PASSWORD=CHANGE_ME_/.test(envExample)) failures.push('environment template must require a private demo password');
if (fs.existsSync(path.join(root, 'infra/vm/.env.vm'))) failures.push('a real .env.vm must never be packaged');

for (const script of fs.readdirSync(path.join(root, 'infra/vm/scripts')).filter((name) => name.endsWith('.sh'))) {
  try {
    execFileSync('bash', ['-n', path.join(root, 'infra/vm/scripts', script)], { stdio: 'pipe' });
  } catch {
    failures.push(`${script} is not valid Bash`);
  }
}

if (failures.length) {
  console.error(failures.map((failure) => `- ${failure}`).join('\n'));
  process.exit(1);
}
console.log('Single-VM deployment safeguards verified.');
