import { z } from 'zod';

const bool = z.preprocess((v) => {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') return ['true', '1', 'yes', 'on'].includes(v.trim().toLowerCase());
  return false;
}, z.boolean());

const optionalString = z
  .string()
  .optional()
  .transform((v) => (v ?? '').trim());

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).optional(),

  // Database
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // API
  API_PORT: z.coerce.number().int().positive().default(4000),
  API_BASE_URL: z.string().url().default('http://localhost:4000'),
  WEB_BASE_URL: z.string().url().default('http://localhost:3000'),
  CORS_ORIGINS: z.string().default('http://localhost:3000'),
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('30d'),
  COOKIE_SECURE: bool.default(false),
  ENCRYPTION_KEY: z.string().min(32, 'ENCRYPTION_KEY must be at least 32 characters (64 hex chars recommended)'),
  RUN_JOBS: bool.default(false),

  // Microsoft Entra ID
  ENTRA_TENANT_ID: optionalString,
  ENTRA_CLIENT_ID: optionalString,
  ENTRA_CLIENT_SECRET: optionalString,
  ENTRA_REDIRECT_URI: z.string().default('http://localhost:4000/api/v1/auth/entra/callback'),

  // Storage
  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  LOCAL_STORAGE_DIR: optionalString,
  S3_ENDPOINT: optionalString,
  S3_REGION: z.string().default('us-east-1'),
  S3_BUCKET: z.string().default('auditsphere-documents'),
  S3_ACCESS_KEY: optionalString,
  S3_SECRET_KEY: optionalString,
  S3_FORCE_PATH_STYLE: bool.default(true),

  // AI (not used by Phase 1 API but validated so misconfiguration surfaces early)
  AI_BASE_URL: optionalString,
  AI_API_KEY: optionalString,
  AI_MODEL: optionalString,
  AI_ENABLED: bool.default(false),

  // Email
  SMTP_HOST: optionalString,
  SMTP_PORT: z.coerce.number().int().default(1025),
  SMTP_USER: optionalString,
  SMTP_PASS: optionalString,
  SMTP_FROM: z.string().default('BDO AuditSphere <no-reply@auditsphere.local>'),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid environment configuration: ${issues}`);
  }
  return result.data;
}
