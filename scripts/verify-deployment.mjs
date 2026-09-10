import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const base = read('infra/k8s/base/kustomization.yaml');
const baseConfig = read('infra/k8s/base/configmap.yaml');
const productionConfig = read('infra/k8s/overlays/production/config.yaml');
const compose = read('infra/docker/docker-compose.yml');
const failures = [];

if (/\bsecret\.ya?ml\b/.test(base)) failures.push('Kubernetes base must not deploy the placeholder secret manifest');
if (!/^\s+STORAGE_DRIVER:\s*s3\s*$/m.test(baseConfig)) failures.push('Kubernetes base must explicitly use durable S3 storage');
if (!/^\s+STORAGE_DRIVER:\s*s3\s*$/m.test(compose)) failures.push('Docker Compose must explicitly use MinIO/S3 storage');
if (!/^\s+AI_ENABLED:\s*["']?false["']?\s*$/m.test(productionConfig)) failures.push('Production AI must default to disabled');
if (!/^\s+MALWARE_SCAN_REQUIRED:\s*["']?true["']?\s*$/m.test(productionConfig)) {
  failures.push('Production document malware scanning must fail closed');
}

if (failures.length) {
  console.error(failures.map((failure) => `- ${failure}`).join('\n'));
  process.exit(1);
}
console.log('Deployment safeguards verified.');
