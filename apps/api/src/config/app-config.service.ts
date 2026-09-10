import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { parseDuration } from './duration';
import { Env, validateEnv } from './env.schema';
import { repoRoot } from './repo-root';

export interface AppConfig {
  env: Env['NODE_ENV'];
  isProduction: boolean;
  logLevel: string;
  databaseUrl: string;
  api: { port: number; baseUrl: string; webBaseUrl: string; corsOrigins: string[]; swaggerEnabled: boolean };
  jwt: { accessSecret: string; refreshSecret: string; accessTtlMs: number; refreshTtlMs: number };
  cookies: { secure: boolean };
  auth: { mfaEnforcement: 'off' | 'audit' | 'all' };
  /** 32-byte key used for AES-256-GCM field encryption. */
  encryptionKey: Buffer;
  jobs: { enabled: boolean };
  entra: { tenantId: string; clientId: string; clientSecret: string; redirectUri: string; configured: boolean };
  storage: {
    driver: 'local' | 's3';
    localDir: string;
    s3: {
      endpoint: string;
      region: string;
      bucket: string;
      accessKey: string;
      secretKey: string;
      forcePathStyle: boolean;
    };
  };
  malwareScan: {
    required: boolean;
    scanner: 'clamav' | 'defender';
    host: string;
    port: number;
    timeoutMs: number;
    defenderPath: string;
  };
  ai: { enabled: boolean; baseUrl: string; apiKey: string; model: string };
  smtp: { enabled: boolean; host: string; port: number; user: string; pass: string; from: string };
}

export function buildConfig(env: Env): AppConfig {
  return {
    env: env.NODE_ENV,
    isProduction: env.NODE_ENV === 'production',
    logLevel: env.LOG_LEVEL ?? (env.NODE_ENV === 'production' ? 'info' : 'debug'),
    databaseUrl: env.DATABASE_URL,
    api: {
      port: env.API_PORT,
      baseUrl: env.API_BASE_URL.replace(/\/+$/, ''),
      webBaseUrl: env.WEB_BASE_URL.replace(/\/+$/, ''),
      corsOrigins: env.CORS_ORIGINS.split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      swaggerEnabled: env.SWAGGER_ENABLED,
    },
    jwt: {
      accessSecret: env.JWT_ACCESS_SECRET,
      refreshSecret: env.JWT_REFRESH_SECRET,
      accessTtlMs: parseDuration(env.JWT_ACCESS_TTL),
      refreshTtlMs: parseDuration(env.JWT_REFRESH_TTL),
    },
    cookies: { secure: env.COOKIE_SECURE },
    auth: { mfaEnforcement: env.MFA_ENFORCEMENT },
    encryptionKey: deriveKey(env.ENCRYPTION_KEY),
    jobs: { enabled: env.RUN_JOBS || process.argv.includes('--worker') },
    entra: {
      tenantId: env.ENTRA_TENANT_ID,
      clientId: env.ENTRA_CLIENT_ID,
      clientSecret: env.ENTRA_CLIENT_SECRET,
      redirectUri: env.ENTRA_REDIRECT_URI,
      configured: Boolean(env.ENTRA_TENANT_ID && env.ENTRA_CLIENT_ID && env.ENTRA_CLIENT_SECRET),
    },
    storage: {
      driver: env.STORAGE_DRIVER,
      localDir: env.LOCAL_STORAGE_DIR || join(repoRoot(), '.local-storage'),
      s3: {
        endpoint: env.S3_ENDPOINT,
        region: env.S3_REGION,
        bucket: env.S3_BUCKET,
        accessKey: env.S3_ACCESS_KEY,
        secretKey: env.S3_SECRET_KEY,
        forcePathStyle: env.S3_FORCE_PATH_STYLE,
      },
    },
    malwareScan: {
      required: env.MALWARE_SCAN_REQUIRED,
      scanner: env.MALWARE_SCANNER,
      host: env.CLAMAV_HOST,
      port: env.CLAMAV_PORT,
      timeoutMs: env.CLAMAV_TIMEOUT_MS,
      defenderPath: env.DEFENDER_MPCMDRUN_PATH,
    },
    ai: {
      enabled: env.AI_ENABLED,
      baseUrl: env.AI_BASE_URL.replace(/\/+$/, ''),
      apiKey: env.AI_API_KEY,
      model: env.AI_MODEL || 'gpt-4o',
    },
    smtp: {
      enabled: Boolean(env.SMTP_HOST),
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
      from: env.SMTP_FROM,
    },
  };
}

/**
 * A 64-character hex string is used verbatim as the 32-byte key. Anything else is
 * hashed with SHA-256 so that a passphrase still yields a well-formed key.
 */
export function deriveKey(raw: string): Buffer {
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, 'hex');
  return createHash('sha256').update(raw).digest();
}

@Injectable()
export class AppConfigService {
  private readonly config: AppConfig;

  constructor() {
    this.config = buildConfig(validateEnv(process.env as Record<string, unknown>));
  }

  get all(): AppConfig {
    return this.config;
  }
  get env() {
    return this.config.env;
  }
  get isProduction() {
    return this.config.isProduction;
  }
  get logLevel() {
    return this.config.logLevel;
  }
  get api() {
    return this.config.api;
  }
  get jwt() {
    return this.config.jwt;
  }
  get cookies() {
    return this.config.cookies;
  }
  get auth() {
    return this.config.auth;
  }
  get encryptionKey() {
    return this.config.encryptionKey;
  }
  get jobs() {
    return this.config.jobs;
  }
  get entra() {
    return this.config.entra;
  }
  get storage() {
    return this.config.storage;
  }
  get malwareScan() {
    return this.config.malwareScan;
  }
  get ai() {
    return this.config.ai;
  }
  get smtp() {
    return this.config.smtp;
  }
}
