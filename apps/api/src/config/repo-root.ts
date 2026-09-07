import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

let cached: string | undefined;

/**
 * Walks up from this file until it finds the pnpm workspace manifest. Works from
 * both `src/` (ts-node / jest) and `dist/` (compiled) because both live under
 * `apps/api`.
 */
export function repoRoot(): string {
  if (cached) return cached;
  let dir = resolve(__dirname);
  for (let i = 0; i < 8; i++) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) {
      cached = dir;
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  // Fallback: assume <root>/apps/api/(src|dist)/config
  cached = resolve(__dirname, '..', '..', '..', '..');
  return cached;
}

export function apiRoot(): string {
  return join(repoRoot(), 'apps', 'api');
}
