import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../common/decorators';
import { ControlListQueryDto, CreateControlDto, CreateControlTestDto, SetControlRisksDto, UpdateControlDto, UpdateControlTestDto } from './controls.dto';
import { ControlsService } from './controls.service';

@ApiTags('controls')
@ApiCookieAuth('as_access')
@Controller()
export class ControlsController {
  constructor(private readonly controls: ControlsService) {}

  @Get('controls')
  @RequirePermission('control:read')
  list(@Query() query: ControlListQueryDto) {
    return this.controls.list(query);
  }

  @Get('controls/:id')
  @RequirePermission('control:read')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.controls.get(id);
  }

  @Post('controls')
  @RequirePermission('control:manage')
  create(@Body() dto: CreateControlDto) {
    return this.controls.create(dto);
  }

  @Patch('controls/:id')
  @RequirePermission('control:manage')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateControlDto) {
    return this.controls.update(id, dto);
  }

  @Put('controls/:id/risks')
  @RequirePermission('control:manage')
  @ApiOperation({ summary: 'Replace the risk-control matrix entries for this control' })
  setRisks(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SetControlRisksDto) {
    return this.controls.setRisks(id, dto);
  }

  @Post('controls/:id/tests')
  @RequirePermission('control:test')
  createTest(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateControlTestDto) {
    return this.controls.createTest(id, dto);
  }

  @Patch('control-tests/:id')
  @RequirePermission('control:test')
  updateTest(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateControlTestDto) {
    return this.controls.updateTest(id, dto);
  }
}
