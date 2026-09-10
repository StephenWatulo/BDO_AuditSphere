import { BadRequestException, Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { ApiBody, ApiConsumes, ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser, RequirePermission } from '../common/decorators';
import { AiInteractionListQueryDto, AiTargetQueryDto, CopilotRequestDto, UpdateAiInteractionDto, UploadAiContextDto } from './ai.dto';
import { AuditContextService } from './audit-context.service';
import { AiService } from './ai.service';
import { AiContextService } from './ai-context.service';
import { MAX_CONTEXT_BYTES } from './context-extractor.service';

@ApiTags('ai')
@ApiCookieAuth('as_access')
@Controller('ai')
export class AiController {
  constructor(private readonly ai: AiService, private readonly context: AiContextService, private readonly auditContext: AuditContextService) {}

  @Get('status')
  @RequirePermission('ai:use')
  status() { return this.ai.status(); }

  @Get('targets')
  @RequirePermission('ai:use')
  targets(@Query() query: AiTargetQueryDto, @CurrentUser() user: AuthUser) { return this.auditContext.targets(query.type, query.q ?? '', user); }

  @Get('interactions/:id')
  @RequirePermission('ai:use')
  interaction(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) { return this.ai.get(id, user); }

  @Post('context-documents')
  @RequirePermission('ai:use')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: MAX_CONTEXT_BYTES, files: 1 } }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', required: ['file'], properties: { file: { type: 'string', format: 'binary' }, classification: { type: 'string' } } } })
  @ApiOperation({ summary: 'Upload and extract a private AI Sphere context document' })
  uploadContext(@UploadedFile() file: Express.Multer.File | undefined, @Body() dto: UploadAiContextDto) {
    if (!file) throw new BadRequestException('A context document is required.');
    return this.context.upload(file, dto.classification);
  }

  @Get('context-documents')
  @RequirePermission('ai:use')
  listContext() { return this.context.list(); }

  @Post('copilot')
  @RequirePermission('ai:use')
  @ApiOperation({ summary: 'Generate an AI Sphere response and record the interaction' })
  complete(@Body() dto: CopilotRequestDto, @CurrentUser() user: AuthUser) {
    return this.ai.complete(dto, user);
  }

  @Get('interactions')
  @RequirePermission('ai:use')
  list(@Query() query: AiInteractionListQueryDto, @CurrentUser() user: AuthUser) {
    return this.ai.list(query, user);
  }

  @Patch('interactions/:id')
  @RequirePermission('ai:use')
  feedback(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateAiInteractionDto, @CurrentUser() user: AuthUser) {
    return this.ai.feedback(id, dto, user);
  }
}
