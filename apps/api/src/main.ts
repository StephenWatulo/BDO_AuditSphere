import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { AppConfigService } from './config/app-config.service';
import { setupSwagger } from './swagger';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  configureApp(app);
  setupSwagger(app);
  app.enableShutdownHooks();

  const config = app.get(AppConfigService);
  await app.listen(config.api.port);
  const mode = config.jobs.enabled ? 'api+worker' : 'api';
  app.get(Logger).log(`AuditSphere API (${mode}) listening on ${config.api.baseUrl}/api/v1 - docs at /api/docs`);
}

bootstrap().catch((err) => {
  console.error('Fatal startup error', err);
  process.exit(1);
});
