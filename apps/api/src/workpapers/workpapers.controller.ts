import { Body, Controller, Get, Param, ParseIntPipe, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser, RequirePermission } from '../common/decorators';
import { TransitionDto } from '../common/dto/transition.dto';
import { CreateReviewNoteDto, CreateWorkpaperDto, CreateWorkpaperTemplateDto, UpdateReviewNoteDto, UpdateWorkpaperDto } from './workpapers.dto';
import { WorkpapersService } from './workpapers.service';

@ApiTags('workpapers')
@ApiCookieAuth('as_access')
@Controller()
export class WorkpapersController {
  constructor(private readonly workpapers: WorkpapersService) {}

  @Get('engagements/:id/workpapers')
  @RequirePermission('workpaper:read')
  listForEngagement(@Param('id', ParseUUIDPipe) id: string) {
    return this.workpapers.listForEngagement(id);
  }

  @Post('engagements/:id/workpapers')
  @RequirePermission('workpaper:prepare')
  create(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateWorkpaperDto) {
    return this.workpapers.create(id, dto);
  }

  @Get('workpapers/:id')
  @RequirePermission('workpaper:read')
  @ApiOperation({ summary: 'Workpaper with versions, review notes, evidence and availableActions' })
  get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.workpapers.get(id, user);
  }

  @Patch('workpapers/:id')
  @RequirePermission('workpaper:prepare')
  @ApiOperation({ summary: 'Edit content; 409 when locked; previous state is stored as a version' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateWorkpaperDto) {
    return this.workpapers.update(id, dto);
  }

  @Get('workpapers/:id/versions/:n')
  @RequirePermission('workpaper:read')
  version(@Param('id', ParseUUIDPipe) id: string, @Param('n', ParseIntPipe) n: number) {
    return this.workpapers.getVersion(id, n);
  }

  @Post('workpapers/:id/transition')
  @RequirePermission('workpaper:read')
  @ApiOperation({ summary: 'Run a WORKPAPER_WORKFLOW action' })
  transition(@Param('id', ParseUUIDPipe) id: string, @Body() dto: TransitionDto, @CurrentUser() user: AuthUser) {
    return this.workpapers.transition(id, dto, user);
  }

  @Post('workpapers/:id/review-notes')
  @RequirePermission('workpaper:review')
  createReviewNote(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateReviewNoteDto) {
    return this.workpapers.createReviewNote(id, dto);
  }

  @Patch('review-notes/:id')
  @RequirePermission('workpaper:prepare', 'workpaper:review')
  updateReviewNote(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateReviewNoteDto, @CurrentUser() user: AuthUser) {
    return this.workpapers.updateReviewNote(id, dto, user);
  }

  @Get('workpaper-templates')
  @RequirePermission('workpaper:read')
  templates() {
    return this.workpapers.listTemplates();
  }

  @Post('workpaper-templates')
  @RequirePermission('program:manage')
  createTemplate(@Body() dto: CreateWorkpaperTemplateDto) {
    return this.workpapers.createTemplate(dto);
  }
}
