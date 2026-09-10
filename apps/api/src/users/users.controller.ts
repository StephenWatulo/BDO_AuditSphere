import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../common/decorators';
import { CreateUserDto, SetRolesDto, UpdateUserDto, UserListQueryDto, UserOptionsQueryDto } from './users.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiCookieAuth('as_access')
@Controller()
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('users')
  @RequirePermission('user:read')
  @ApiOperation({ summary: 'List users' })
  list(@Query() query: UserListQueryDto) {
    return this.users.list(query);
  }

  @Get('users/options')
  @RequirePermission('user:read', 'finding:respond')
  @ApiOperation({ summary: 'Active users for assignment, limited to basic contact details' })
  options(@Query() query: UserOptionsQueryDto) {
    return this.users.options(query);
  }

  @Get('users/:id')
  @RequirePermission('user:read')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.users.get(id);
  }

  @Post('users')
  @RequirePermission('user:manage')
  @ApiOperation({ summary: 'Create or invite a user (temporary password returned once when no password is given)' })
  create(@Body() dto: CreateUserDto) {
    return this.users.create(dto);
  }

  @Patch('users/:id')
  @RequirePermission('user:manage')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUserDto) {
    return this.users.update(id, dto);
  }

  @Put('users/:id/roles')
  @RequirePermission('user:manage')
  setRoles(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SetRolesDto) {
    return this.users.setRoles(id, dto);
  }

  @Get('roles')
  @RequirePermission('user:read')
  @ApiOperation({ summary: 'Roles with their permission keys' })
  roles() {
    return this.users.roles();
  }
}
