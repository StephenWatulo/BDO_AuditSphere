import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Req,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { memoryStorage } from 'multer';
import { RequirePermission } from '../common/decorators';
import { CompleteUploadDto, DocumentListQueryDto, MAX_DOCUMENT_BYTES, PresignUploadDto, UploadDocumentDto } from './documents.dto';
import { DocumentsService } from './documents.service';

@ApiTags('documents')
@ApiCookieAuth('as_access')
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Post('presign-upload')
  @RequirePermission('document:upload')
  @ApiOperation({ summary: 'Create a document record and a presigned PUT target (local driver: /documents/:id/content)' })
  presign(@Body() dto: PresignUploadDto) {
    return this.documents.presignUpload(dto);
  }

  @Post(':id/complete')
  @RequirePermission('document:upload')
  @ApiOperation({ summary: 'Mark the upload finished and verify the stored object' })
  complete(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CompleteUploadDto) {
    return this.documents.complete(id, dto);
  }

  @Post('upload')
  @RequirePermission('document:upload')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: MAX_DOCUMENT_BYTES, files: 1 } }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'ownerType', 'ownerId'],
      properties: {
        file: { type: 'string', format: 'binary' },
        ownerType: { type: 'string' },
        ownerId: { type: 'string', format: 'uuid' },
        classification: { type: 'string' },
      },
    },
  })
  @ApiOperation({ summary: 'Single-call multipart upload (max 50 MB)' })
  upload(@UploadedFile() file: Express.Multer.File | undefined, @Body() dto: UploadDocumentDto) {
    if (!file) throw new BadRequestException('file is required');
    return this.documents.upload(file, dto);
  }

  @Put(':id/content')
  @RequirePermission('document:upload')
  @ApiOperation({ summary: 'Local driver: raw PUT of the file bytes' })
  putContent(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.documents.putContent(id, req.body as Buffer, req.headers['content-type']);
  }

  @Get(':id/content')
  @RequirePermission('document:read')
  @Header('Cache-Control', 'private, no-store')
  @ApiOperation({ summary: 'Local driver: stream the file bytes' })
  async getContent(@Param('id', ParseUUIDPipe) id: string) {
    const { doc, stream } = await this.documents.getContent(id);
    return new StreamableFile(stream, {
      type: doc.mimeType,
      disposition: `attachment; filename*=UTF-8''${encodeURIComponent(doc.fileName)}`,
      length: Number(doc.sizeBytes),
    });
  }

  @Get()
  @RequirePermission('document:read')
  list(@Query() query: DocumentListQueryDto) {
    return this.documents.list(query);
  }

  @Get(':id')
  @RequirePermission('document:read')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.documents.get(id);
  }

  @Get(':id/download')
  @RequirePermission('document:read')
  @ApiOperation({ summary: 'Presigned download URL (5 minutes); records document.downloaded' })
  download(@Param('id', ParseUUIDPipe) id: string) {
    return this.documents.download(id);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermission('document:delete')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.documents.remove(id);
  }
}
