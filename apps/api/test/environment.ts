import { join } from 'node:path';

export function testEnvironment(env: NodeJS.ProcessEnv, storageRoot: string): NodeJS.ProcessEnv {
  if (!env.E2E_DATABASE_URL) {
    throw new Error('Set E2E_DATABASE_URL to a dedicated local auditsphere_test database. The normal .env database is never used for HTTP tests.');
  }
  let url: URL;
  try { url = new URL(env.E2E_DATABASE_URL); }
  catch { throw new Error('E2E_DATABASE_URL must be a valid PostgreSQL URL.'); }
  const database = url.pathname.slice(1);
  if (!['postgres:', 'postgresql:'].includes(url.protocol)
    || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    || !/^auditsphere_test(?:_[a-z0-9_]+)?$/.test(database)
    || [...url.searchParams.keys()].some((key) => !['schema', 'sslmode'].includes(key))
    || (url.searchParams.has('schema') && url.searchParams.get('schema') !== 'public')) {
    throw new Error('HTTP tests require a loopback PostgreSQL URL, the public schema, and a database named auditsphere_test or auditsphere_test_<suffix>.');
  }
  return {
    NODE_ENV: 'test',
    DATABASE_URL: env.E2E_DATABASE_URL,
    JWT_ACCESS_SECRET: 'e2e-only-access-secret-at-least-32-characters',
    JWT_REFRESH_SECRET: 'e2e-only-refresh-secret-at-least-32-characters',
    ENCRYPTION_KEY: '0123456789abcdef'.repeat(4),
    COOKIE_SECURE: 'false',
    // Workflow E2E tests exercise application features; MFA has dedicated tests.
    MFA_ENFORCEMENT: 'off',
    STORAGE_DRIVER: 'local',
    LOCAL_STORAGE_DIR: join(storageRoot, database),
    RUN_JOBS: 'false',
    AI_ENABLED: 'false',
    AI_API_KEY: '',
    SMTP_HOST: '',
    SMTP_USER: '',
    SMTP_PASS: '',
    ENTRA_TENANT_ID: '',
    ENTRA_CLIENT_ID: '',
    ENTRA_CLIENT_SECRET: '',
    LOG_LEVEL: 'error',
  };
}
