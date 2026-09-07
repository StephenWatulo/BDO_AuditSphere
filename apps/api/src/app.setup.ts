import { INestApplication, ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import express, { NextFunction, Request, Response, type Express } from 'express';
import helmet from 'helmet';
import { requestContextMiddleware } from './common/request-context.middleware';
import { AppConfigService } from './config/app-config.service';
import { PrismaService } from './prisma/prisma.service';
import { StorageService } from './storage/storage.service';
import { TenantContext } from './tenancy/tenant-context';

export const API_PREFIX = 'api/v1';
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

const startedAt = Date.now();

function registerOperationalProbeRoutes(server: Express, prisma: PrismaService, storage: StorageService): void {
  server.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000), timestamp: new Date().toISOString() });
  });

  server.get('/ready', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const [database, storageOk] = await Promise.all([prisma.ping(), storage.healthCheck()]);
      const ready = database && storageOk;
      res.status(ready ? 200 : 503).json({
        status: ready ? 'ready' : 'degraded',
        checks: { database: database ? 'up' : 'down', storage: storageOk ? 'up' : 'down', storageDriver: storage.driverName },
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      next(err);
    }
  });
}

/**
 * Applies the HTTP pipeline shared by `main.ts` and the e2e tests. Guards,
 * filters and interceptors are registered as APP_* providers in AppModule.
 */
export function configureApp(app: INestApplication): void {
  const config = app.get(AppConfigService);
  const ctx = app.get(TenantContext);
  const express_ = app as NestExpressApplication;
  if (typeof express_.set === 'function') express_.set('trust proxy', 1);

  app.use(requestContextMiddleware(ctx));
  app.use(
    helmet({
      contentSecurityPolicy: false, // API only; the web app sets its own CSP
      crossOriginResourcePolicy: { policy: 'same-site' },
    }),
  );
  app.enableCors({
    origin: config.api.corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id', 'X-Download-Mode'],
    exposedHeaders: ['x-request-id', 'Content-Disposition', 'X-Download-Disposition'],
  });
  // Probes are registered after the request-context and security middleware so
  // they carry x-request-id and the helmet headers, but before cookies, body
  // parsing and the /api/v1 prefix so they stay cheap and unauthenticated.
  registerOperationalProbeRoutes(app.getHttpAdapter().getInstance() as Express, app.get(PrismaService), app.get(StorageService));
  app.use(cookieParser());
  // Raw body for local-driver uploads (PUT /documents/:id/content). Registered
  // before the JSON parser so it owns the body for that route only.
  app.use(/^\/api\/v1\/documents\/[^/]+\/content$/, (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'PUT') return next();
    return express.raw({ type: () => true, limit: MAX_UPLOAD_BYTES })(req, res, next);
  });

  app.setGlobalPrefix(API_PREFIX);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
      transformOptions: { enableImplicitConversion: false },
    }),
  );
}
