import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const full = process.argv.includes('--full');
if (!process.env.npm_execpath) throw new Error('Run this check with pnpm verify or pnpm verify:full.');
if (full && !process.env.E2E_DATABASE_URL) throw new Error('Set E2E_DATABASE_URL to a migrated, seeded auditsphere_test database before pnpm verify:full.');

const commands = [
  ['--filter', '@auditsphere/shared', '--filter', '@auditsphere/db', 'build'],
  ['-r', 'typecheck'],
  ['-r', 'run', '--if-present', 'lint'],
  ['-r', 'run', '--if-present', 'test'],
  ...(full ? [['--filter', '@auditsphere/api', 'test:e2e']] : []),
  ['-r', 'build'],
];
for (const args of commands) {
  console.log(`\n[verify] pnpm ${args.join(' ')}`);
  const result = spawnSync(process.execPath, [process.env.npm_execpath, ...args], {
    cwd: root,
    env: process.env,
    stdio: 'inherit',
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log(`\n[verify] ${full ? 'Full verification' : 'Static, unit and build checks'} passed.`);
