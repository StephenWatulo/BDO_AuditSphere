import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser, RequirePermission } from '../common/decorators';
import { TransitionDto } from '../common/dto/transition.dto';
import { CreateRequestDto, LinkDocumentDto, RequestListQueryDto, UpdateRequestDto } from './requests.dto';
import { RequestsService } from './requests.service';

@ApiTags('requests')
@ApiCookieAuth('as_access')
@Controller('requests')
export class RequestsController {
  constructor(private readonly requests: RequestsService) {}

  @Get()
  @RequirePermission('request:read')
  list(@Query() query: RequestListQueryDto, @CurrentUser() user: AuthUser) {
    return this.requests.list(query, user);
  }

  @Post()
  @RequirePermission('request:manage')
  @ApiOperation({ summary: 'Raise a document request (reference auto DR-01)' })
  create(@Body() dto: CreateRequestDto) {
    return this.requests.create(dto);
  }

  @Get(':id')
  @RequirePermission('request:read')
  get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.requests.get(id, user);
  }

  @Patch(':id')
  @RequirePermission('request:manage', 'request:respond')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateRequestDto, @CurrentUser() user: AuthUser) {
    return this.requests.update(id, dto, user);
  }

  @Post(':id/transition')
  @RequirePermission('request:read')
  @ApiOperation({ summary: 'Run a REQUEST_WORKFLOW action' })
  transition(@Param('id', ParseUUIDPipe) id: string, @Body() dto: TransitionDto, @CurrentUser() user: AuthUser) {
    return this.requests.transition(id, dto, user);
  }

  @Post(':id/documents')
  @RequirePermission('request:manage', 'request:respond')
  @ApiOperation({ summary: 'Link an uploaded document to the request' })
  linkDocument(@Param('id', ParseUUIDPipe) id: string, @Body() dto: LinkDocumentDto, @CurrentUser() user: AuthUser) {
    return this.requests.linkDocument(id, dto, user);
  }
}
