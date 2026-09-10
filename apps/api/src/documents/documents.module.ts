import { Module } from '@nestjs/common';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { MalwareScannerService } from './malware-scanner.service';

@Module({
  controllers: [DocumentsController],
  providers: [DocumentsService, MalwareScannerService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
