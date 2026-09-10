import { validateEnv } from './env.schema';

const base = {
  DATABASE_URL: 'postgresql://owner:secret@127.0.0.1:5432/auditsphere',
  JWT_ACCESS_SECRET: 'a'.repeat(48),
  JWT_REFRESH_SECRET: 'b'.repeat(48),
  ENCRYPTION_KEY: 'cd'.repeat(32),
};

describe('environment security policy', () => {
  it('allows developer defaults while keeping access and refresh secrets distinct', () => {
    expect(validateEnv(base).NODE_ENV).toBe('development');
    expect(() => validateEnv({ ...base, JWT_REFRESH_SECRET: base.JWT_ACCESS_SECRET })).toThrow('must be different');
  });

  it('accepts a hardened Windows production configuration', () => {
    const env = validateEnv({
      ...base,
      NODE_ENV: 'production',
      API_BASE_URL: 'https://audit.example.test',
      WEB_BASE_URL: 'https://audit.example.test',
      CORS_ORIGINS: 'https://audit.example.test',
      COOKIE_SECURE: 'true',
      MFA_ENFORCEMENT: 'all',
      STORAGE_DRIVER: 'local',
      LOCAL_STORAGE_DIR: 'D:\\AuditSphereData\\documents',
      MALWARE_SCAN_REQUIRED: 'true',
      MALWARE_SCANNER: 'defender',
      SWAGGER_ENABLED: 'false',
    });
    expect(env.MALWARE_SCANNER).toBe('defender');
  });

  it('rejects an insecure production launch', () => {
    expect(() => validateEnv({ ...base, NODE_ENV: 'production' })).toThrow(/COOKIE_SECURE|HTTPS|Malware scanning/);
    expect(() => validateEnv({
      ...base,
      NODE_ENV: 'production',
      COOKIE_SECURE: 'true',
      API_BASE_URL: 'https://audit.example.test',
      WEB_BASE_URL: 'https://audit.example.test',
      CORS_ORIGINS: '*',
      LOCAL_STORAGE_DIR: 'D:\\data',
      MALWARE_SCAN_REQUIRED: 'true',
      MALWARE_SCANNER: 'defender',
      SWAGGER_ENABLED: 'true',
    })).toThrow(/SWAGGER_ENABLED|CORS_ORIGINS/);
  });
});

