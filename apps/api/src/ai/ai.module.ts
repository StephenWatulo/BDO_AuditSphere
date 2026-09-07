import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { DocumentsModule } from '../documents/documents.module';
import { AiContextService } from './ai-context.service';
import { ContextExtractorService } from './context-extractor.service';

@Module({
  imports: [DocumentsModule],
  controllers: [AiController],
  providers: [AiService, AiContextService, ContextExtractorService],
  exports: [AiService],
})
export class AiModule {}
