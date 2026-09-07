import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../common/decorators';
import {
  AssessRiskDto,
  CreateRiskCategoryDto,
  CreateRiskDto,
  CreateScoringModelDto,
  RiskListQueryDto,
  UpdateRiskDto,
  UpdateScoringModelDto,
} from './risks.dto';
import { RisksService } from './risks.service';

@ApiTags('risks')
@ApiCookieAuth('as_access')
@Controller()
export class RisksController {
  constructor(private readonly risks: RisksService) {}

  @Get('risks')
  @RequirePermission('risk:read')
  list(@Query() query: RiskListQueryDto) {
    return this.risks.list(query);
  }

  @Get('risks/heatmap')
  @RequirePermission('risk:read')
  @ApiOperation({ summary: '5x5 residual heat map counts' })
  @ApiQuery({ name: 'status', required: false })
  heatmap(@Query('status') status?: string) {
    return this.risks.heatmap(status);
  }

  @Get('risks/:id')
  @RequirePermission('risk:read')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.risks.get(id);
  }

  @Post('risks')
  @RequirePermission('risk:manage')
  create(@Body() dto: CreateRiskDto) {
    return this.risks.create(dto);
  }

  @Patch('risks/:id')
  @RequirePermission('risk:manage')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateRiskDto) {
    return this.risks.update(id, dto);
  }

  @Post('risks/:id/assess')
  @RequirePermission('risk:assess')
  @ApiOperation({ summary: 'Record a periodic assessment and rescore the risk' })
  assess(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AssessRiskDto) {
    return this.risks.assess(id, dto);
  }

  @Get('risk-categories')
  @RequirePermission('risk:read')
  categories() {
    return this.risks.listCategories();
  }

  @Post('risk-categories')
  @RequirePermission('risk:manage', 'risk:configure_scoring')
  createCategory(@Body() dto: CreateRiskCategoryDto) {
    return this.risks.createCategory(dto);
  }

  @Get('scoring-models')
  @RequirePermission('risk:read')
  scoringModels() {
    return this.risks.listScoringModels();
  }

  @Post('scoring-models')
  @RequirePermission('risk:configure_scoring')
  createScoringModel(@Body() dto: CreateScoringModelDto) {
    return this.risks.createScoringModel(dto);
  }

  @Patch('scoring-models/:id')
  @RequirePermission('risk:configure_scoring')
  updateScoringModel(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateScoringModelDto) {
    return this.risks.updateScoringModel(id, dto);
  }
}
