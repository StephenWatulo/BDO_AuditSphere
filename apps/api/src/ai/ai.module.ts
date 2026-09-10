import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { DocumentsModule } from '../documents/documents.module';
import { AiContextService } from './ai-context.service';
import { ContextExtractorService } from './context-extractor.service';
import { AuditContextService } from './audit-context.service';
import { AuditUniverseIndexService } from './audit-universe-index.service';

@Module({
  imports: [DocumentsModule],
  controllers: [AiController],
  providers: [AiService, AiContextService, ContextExtractorService, AuditContextService, AuditUniverseIndexService],
  exports: [AiService],
})
export class AiModule {}
