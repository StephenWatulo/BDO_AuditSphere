import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../common/decorators';
import {
  CreateEntityDto,
  CreateProcessDto,
  EntityListQueryDto,
  ProcessListQueryDto,
  UpdateEntityDto,
  UpdateProcessDto,
} from './universe.dto';
import { UniverseService } from './universe.service';

@ApiTags('universe')
@ApiCookieAuth('as_access')
@Controller('universe')
export class UniverseController {
  constructor(private readonly universe: UniverseService) {}

  @Get('entities')
  @RequirePermission('universe:read')
  @ApiOperation({ summary: 'Entity tree (or paged flat list with ?flat=true)' })
  listEntities(@Query() query: EntityListQueryDto) {
    return this.universe.listEntities(query);
  }

  @Get('coverage')
  @RequirePermission('universe:read')
  @ApiOperation({ summary: 'Audit coverage statistics' })
  coverage() {
    return this.universe.coverage();
  }

  @Get('entities/:id')
  @RequirePermission('universe:read')
  getEntity(@Param('id', ParseUUIDPipe) id: string) {
    return this.universe.getEntity(id);
  }

  @Post('entities')
  @RequirePermission('universe:manage')
  createEntity(@Body() dto: CreateEntityDto) {
    return this.universe.createEntity(dto);
  }

  @Patch('entities/:id')
  @RequirePermission('universe:manage')
  updateEntity(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateEntityDto) {
    return this.universe.updateEntity(id, dto);
  }

  @Delete('entities/:id')
  @HttpCode(204)
  @RequirePermission('universe:manage')
  @ApiOperation({ summary: 'Soft-delete an entity' })
  deleteEntity(@Param('id', ParseUUIDPipe) id: string) {
    return this.universe.deleteEntity(id);
  }

  @Get('processes')
  @RequirePermission('universe:read')
  listProcesses(@Query() query: ProcessListQueryDto) {
    return this.universe.listProcesses(query);
  }

  @Post('processes')
  @RequirePermission('universe:manage')
  createProcess(@Body() dto: CreateProcessDto) {
    return this.universe.createProcess(dto);
  }

  @Patch('processes/:id')
  @RequirePermission('universe:manage')
  updateProcess(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateProcessDto) {
    return this.universe.updateProcess(id, dto);
  }
}
