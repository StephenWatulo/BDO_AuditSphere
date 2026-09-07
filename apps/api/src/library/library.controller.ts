import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser, RequirePermission } from '../common/decorators';
import { CreateLibraryItemDto, LibraryDecisionDto, LibraryListQueryDto, UpdateLibraryItemDto } from './library.dto';
import { LibraryService } from './library.service';

@ApiTags('library')
@ApiCookieAuth('as_access')
@Controller('library')
export class LibraryController {
  constructor(private readonly library: LibraryService) {}

  @Get('items')
  @RequirePermission('library:read')
  list(@Query() query: LibraryListQueryDto) {
    return this.library.list(query);
  }

  @Get('frameworks')
  @RequirePermission('library:read')
  @ApiOperation({ summary: 'Frameworks (COSO, COBIT, ...) with their references' })
  frameworks() {
    return this.library.frameworks();
  }

  @Get('items/:id')
  @RequirePermission('library:read')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.library.get(id);
  }

  @Post('items')
  @RequirePermission('library:contribute')
  create(@Body() dto: CreateLibraryItemDto) {
    return this.library.create(dto);
  }

  @Patch('items/:id')
  @RequirePermission('library:contribute')
  @ApiOperation({ summary: 'Edit an item; editing a PUBLISHED item creates a new DRAFT version' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateLibraryItemDto) {
    return this.library.update(id, dto);
  }

  @Post('items/:id/submit')
  @RequirePermission('library:contribute')
  submit(@Param('id', ParseUUIDPipe) id: string, @Body() dto: LibraryDecisionDto) {
    return this.library.submit(id, dto);
  }

  @Post('items/:id/approve')
  @RequirePermission('library:approve')
  approve(@Param('id', ParseUUIDPipe) id: string, @Body() dto: LibraryDecisionDto, @CurrentUser() user: AuthUser) {
    return this.library.approve(id, dto, user);
  }

  @Post('items/:id/retire')
  @RequirePermission('library:approve')
  retire(@Param('id', ParseUUIDPipe) id: string, @Body() dto: LibraryDecisionDto) {
    return this.library.retire(id, dto);
  }
}
