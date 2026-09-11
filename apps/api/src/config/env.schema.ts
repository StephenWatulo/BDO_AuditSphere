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
  API_HOST: z.string().min(1).default('0.0.0.0'),
  SWAGGER_ENABLED: bool.default(false),
  API_BASE_URL: z.string().url().default('http://localhost:4000'),
  WEB_BASE_URL: z.string().url().default('http://localhost:3000'),
  CORS_ORIGINS: z.string().default('http://localhost:3000'),
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('30d'),
  COOKIE_SECURE: bool.default(false),
  MFA_ENFORCEMENT: z.enum(['off', 'audit', 'all']).default('audit'),
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
  MALWARE_SCAN_REQUIRED: bool.default(false),
  MALWARE_SCANNER: z.enum(['clamav', 'defender']).default('clamav'),
  CLAMAV_HOST: optionalString,
  CLAMAV_PORT: z.coerce.number().int().positive().default(3310),
  CLAMAV_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120000).default(60000),
  DEFENDER_MPCMDRUN_PATH: optionalString,

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
}).superRefine((env, ctx) => {
  const issue = (path: string, message: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });

  if (env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET) {
    issue('JWT_REFRESH_SECRET', 'JWT access and refresh secrets must be different');
  }
  if (env.STORAGE_DRIVER === 'local' && env.NODE_ENV === 'production' && !env.LOCAL_STORAGE_DIR) {
    issue('LOCAL_STORAGE_DIR', 'LOCAL_STORAGE_DIR is required when STORAGE_DRIVER=local');
  }
  if (env.STORAGE_DRIVER === 's3') {
    if (!env.S3_ENDPOINT) issue('S3_ENDPOINT', 'S3_ENDPOINT is required when STORAGE_DRIVER=s3');
    if (!env.S3_ACCESS_KEY) issue('S3_ACCESS_KEY', 'S3_ACCESS_KEY is required when STORAGE_DRIVER=s3');
    if (!env.S3_SECRET_KEY) issue('S3_SECRET_KEY', 'S3_SECRET_KEY is required when STORAGE_DRIVER=s3');
  }
  if (env.MALWARE_SCAN_REQUIRED && env.MALWARE_SCANNER === 'clamav' && !env.CLAMAV_HOST) {
    issue('CLAMAV_HOST', 'CLAMAV_HOST is required when malware scanning is mandatory');
  }
  if (env.AI_ENABLED) {
    if (!env.AI_BASE_URL) issue('AI_BASE_URL', 'AI_BASE_URL is required when AI is enabled');
    if (!env.AI_API_KEY) issue('AI_API_KEY', 'AI_API_KEY is required when AI is enabled');
    if (!env.AI_MODEL) issue('AI_MODEL', 'AI_MODEL is required when AI is enabled');
  }

  if (env.NODE_ENV !== 'production') return;
  if (!env.COOKIE_SECURE) issue('COOKIE_SECURE', 'COOKIE_SECURE must be true in production');
  if (env.SWAGGER_ENABLED) issue('SWAGGER_ENABLED', 'Interactive API documentation must be disabled in production');
  if (env.MFA_ENFORCEMENT === 'off') issue('MFA_ENFORCEMENT', 'MFA enforcement cannot be disabled in production');
  if (!env.MALWARE_SCAN_REQUIRED) issue('MALWARE_SCAN_REQUIRED', 'Malware scanning must be required in production');
  if (!env.API_BASE_URL.startsWith('https://')) issue('API_BASE_URL', 'API_BASE_URL must use HTTPS in production');
  if (!env.WEB_BASE_URL.startsWith('https://')) issue('WEB_BASE_URL', 'WEB_BASE_URL must use HTTPS in production');
  const origins = env.CORS_ORIGINS.split(',').map((v) => v.trim()).filter(Boolean);
  if (!origins.length || origins.some((v) => v === '*' || !v.startsWith('https://'))) {
    issue('CORS_ORIGINS', 'Production CORS origins must be explicit HTTPS origins');
  }
  for (const [key, value] of [
    ['JWT_ACCESS_SECRET', env.JWT_ACCESS_SECRET],
    ['JWT_REFRESH_SECRET', env.JWT_REFRESH_SECRET],
    ['ENCRYPTION_KEY', env.ENCRYPTION_KEY],
  ] as const) {
    if (/change[_-]?me|example|auditsphere/i.test(value)) issue(key, `${key} still looks like a placeholder`);
  }
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
