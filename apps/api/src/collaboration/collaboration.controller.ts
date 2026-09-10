import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser, RequirePermission } from '../common/decorators';
import { CommentListQueryDto, CreateCommentDto, CreateTaskDto, TaskListQueryDto, UpdateTaskDto } from './collaboration.dto';
import { CommentsService } from './comments.service';
import { TasksService } from './tasks.service';

@ApiTags('collaboration')
@ApiCookieAuth('as_access')
@Controller()
export class CollaborationController {
  constructor(
    private readonly tasks: TasksService,
    private readonly comments: CommentsService,
  ) {}

  @Get('tasks')
  @RequirePermission('engagement:read')
  listTasks(@Query() query: TaskListQueryDto, @CurrentUser() user: AuthUser) {
    return this.tasks.list(query, user);
  }

  @Post('tasks')
  @RequirePermission('engagement:read')
  createTask(@Body() dto: CreateTaskDto, @CurrentUser() user: AuthUser) {
    return this.tasks.create(dto, user);
  }

  @Patch('tasks/:id')
  @RequirePermission('engagement:read')
  updateTask(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTaskDto, @CurrentUser() user: AuthUser) {
    return this.tasks.update(id, dto, user);
  }

  @Get('comments')
  @RequirePermission('engagement:read', 'finding:read', 'request:read', 'workpaper:read')
  listComments(@Query() query: CommentListQueryDto, @CurrentUser() user: AuthUser) {
    return this.comments.list(query, user);
  }

  @Post('comments')
  @RequirePermission('engagement:read', 'finding:read', 'request:read', 'workpaper:read')
  createComment(@Body() dto: CreateCommentDto, @CurrentUser() user: AuthUser) {
    return this.comments.create(dto, user);
  }
}
