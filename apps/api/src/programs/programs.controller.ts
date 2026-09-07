import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser, RequirePermission } from '../common/decorators';
import { ReorderDto } from '../workpapers/workpapers.dto';
import { CreateProgramDto, CreateStepDto, UpdateStepDto } from './programs.dto';
import { ProgramsService } from './programs.service';

@ApiTags('programs')
@ApiCookieAuth('as_access')
@Controller()
export class ProgramsController {
  constructor(private readonly programs: ProgramsService) {}

  @Get('engagements/:id/programs')
  @RequirePermission('workpaper:read', 'engagement:read')
  list(@Param('id', ParseUUIDPipe) id: string) {
    return this.programs.listForEngagement(id);
  }

  @Post('engagements/:id/programs')
  @RequirePermission('program:manage')
  @ApiOperation({ summary: 'Create a programme, optionally instantiated from a library AUDIT_PROGRAM item' })
  create(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateProgramDto) {
    return this.programs.create(id, dto);
  }

  @Post('programs/:id/steps')
  @RequirePermission('program:manage')
  addStep(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateStepDto) {
    return this.programs.addStep(id, dto);
  }

  @Post('programs/:id/reorder')
  @RequirePermission('program:manage')
  reorder(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ReorderDto) {
    return this.programs.reorder(id, dto);
  }

  @Post('programs/:id/approve')
  @RequirePermission('program:approve')
  approve(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.programs.approve(id, user.id);
  }

  @Patch('program-steps/:id')
  @RequirePermission('program:manage', 'workpaper:prepare')
  updateStep(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateStepDto) {
    return this.programs.updateStep(id, dto);
  }

  @Delete('program-steps/:id')
  @HttpCode(204)
  @RequirePermission('program:manage')
  deleteStep(@Param('id', ParseUUIDPipe) id: string) {
    return this.programs.deleteStep(id);
  }

  @Post('program-steps/:id/create-workpaper')
  @RequirePermission('workpaper:prepare')
  @ApiOperation({ summary: 'Create a workpaper prefilled from the step objective and procedure' })
  createWorkpaper(@Param('id', ParseUUIDPipe) id: string) {
    return this.programs.createWorkpaperFromStep(id);
  }
}
