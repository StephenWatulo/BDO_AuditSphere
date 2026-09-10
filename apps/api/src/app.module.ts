import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import { AuditTrailModule } from './audit-trail/audit-trail.module';
import { AiModule } from './ai/ai.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { PermissionsGuard } from './auth/guards/permissions.guard';
import { CollaborationModule } from './collaboration/collaboration.module';
import { HttpExceptionFilter } from './common/http-exception.filter';
import { SerializeInterceptor } from './common/serialize.interceptor';
import { BrowserDownloadInterceptor } from './common/browser-download.interceptor';
import { AppConfigService } from './config/app-config.service';
import { AppConfigModule } from './config/config.module';
import { ControlsModule } from './controls/controls.module';
import { DashboardsModule } from './dashboards/dashboards.module';
import { DocumentsModule } from './documents/documents.module';
import { EngagementsModule } from './engagements/engagements.module';
import { EvidenceModule } from './evidence/evidence.module';
import { FindingsModule } from './findings/findings.module';
import { HealthModule } from './health/health.module';
import { HelpModule } from './help/help.module';
import { JobsModule, jobsEnabled } from './jobs/jobs.module';
import { LibraryModule } from './library/library.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PlansModule } from './plans/plans.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProgramsModule } from './programs/programs.module';
import { ReportsModule } from './reports/reports.module';
import { RequestsModule } from './requests/requests.module';
import { ResourcesModule } from './resources/resources.module';
import { RisksModule } from './risks/risks.module';
import { SearchModule } from './search/search.module';
import { StorageModule } from './storage/storage.module';
import { TenancyModule } from './tenancy/tenancy.module';
import { UniverseModule } from './universe/universe.module';
import { UsersModule } from './users/users.module';
import { WorkflowModule } from './workflow/workflow.module';
import { WorkpapersModule } from './workpapers/workpapers.module';
import { MonitoringModule } from './monitoring/monitoring.module';

@Module({
  imports: [
    AppConfigModule,
    LoggerModule.forRootAsync({
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        pinoHttp: {
          level: config.logLevel,
          genReqId: (req: IncomingMessage) => (req.headers['x-request-id'] as string | undefined) ?? randomUUID(),
          autoLogging: { ignore: (req: IncomingMessage) => /^\/(api\/v1\/)?(health|ready)$/.test(req.url ?? '') },
          redact: { paths: ['req.headers.cookie', 'req.headers.authorization', 'res.headers["set-cookie"]'], censor: '[redacted]' },
          transport: config.isProduction || config.env === 'test' ? undefined : { target: 'pino-pretty', options: { colorize: true, singleLine: true, translateTime: 'SYS:HH:MM:ss' } },
        },
      }),
    }),
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 100 }]),
    // Cross-cutting (all @Global)
    TenancyModule,
    PrismaModule,
    AuditTrailModule,
    WorkflowModule,
    NotificationsModule,
    StorageModule,
    AuthModule,
    HealthModule,
    HelpModule,
    // Domain
    UsersModule,
    AiModule,
    UniverseModule,
    RisksModule,
    ControlsModule,
    EngagementsModule,
    PlansModule,
    WorkpapersModule,
    ProgramsModule,
    DocumentsModule,
    EvidenceModule,
    FindingsModule,
    RequestsModule,
    ResourcesModule,
    CollaborationModule,
    LibraryModule,
    DashboardsModule,
    ReportsModule,
    MonitoringModule,
    SearchModule,
    // Scheduled jobs only in worker mode
    ...(jobsEnabled() ? [JobsModule] : []),
  ],
  providers: [
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: SerializeInterceptor },
    { provide: APP_INTERCEPTOR, useClass: BrowserDownloadInterceptor },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule {}
