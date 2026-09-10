import { join } from 'node:path';
import { testEnvironment } from '../../test/environment';

describe('HTTP test isolation', () => {
  it('never falls back to the application DATABASE_URL', () => {
    expect(() => testEnvironment({ DATABASE_URL: 'postgresql://localhost/auditsphere' }, '/tmp')).toThrow('E2E_DATABASE_URL');
  });

  it.each([
    'not-a-url',
    'https://localhost/auditsphere_test',
    'postgresql://localhost/auditsphere',
    'postgresql://production.example/auditsphere_test',
    'postgresql://localhost/auditsphere_test/other',
    'postgresql://localhost/auditsphere_test?host=production.example',
    'postgresql://localhost/auditsphere_test?schema=client',
  ])('rejects unsafe configuration %s', (url) => {
    expect(() => testEnvironment({ E2E_DATABASE_URL: url }, '/tmp')).toThrow();
  });

  it.each(['localhost', '127.0.0.1', '[::1]'])('accepts the dedicated database on %s', (host) => {
    const url = `postgresql://test:test@${host}:5432/auditsphere_test_ci?schema=public`;
    const original = { E2E_DATABASE_URL: url, DATABASE_URL: 'postgresql://localhost/auditsphere', AI_ENABLED: 'true', SMTP_HOST: 'mail.example' };
    const configured = testEnvironment(original, '/tmp');
    expect(configured.DATABASE_URL).toBe(url);
    expect(configured.LOCAL_STORAGE_DIR).toBe(join('/tmp', 'auditsphere_test_ci'));
    expect(configured).toMatchObject({ AI_ENABLED: 'false', SMTP_HOST: '', RUN_JOBS: 'false', STORAGE_DRIVER: 'local', ENTRA_CLIENT_SECRET: '' });
    expect(original.DATABASE_URL).toBe('postgresql://localhost/auditsphere');
  });
});
