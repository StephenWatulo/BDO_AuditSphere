import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('BDO AuditSphere API')
    .setDescription('Internal audit management platform - Phase 1 API. Base path /api/v1, cookie authentication.')
    .setVersion('1.0')
    .addCookieAuth('as_access', { type: 'apiKey', in: 'cookie', name: 'as_access' })
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    jsonDocumentUrl: 'api/docs-json',
    swaggerOptions: { persistAuthorization: true, docExpansion: 'none' },
  });
}
