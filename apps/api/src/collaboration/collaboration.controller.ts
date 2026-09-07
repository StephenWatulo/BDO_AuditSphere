import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../common/decorators';
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
  listTasks(@Query() query: TaskListQueryDto, @CurrentUser() user: AuthUser) {
    return this.tasks.list(query, user);
  }

  @Post('tasks')
  createTask(@Body() dto: CreateTaskDto) {
    return this.tasks.create(dto);
  }

  @Patch('tasks/:id')
  updateTask(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTaskDto, @CurrentUser() user: AuthUser) {
    return this.tasks.update(id, dto, user);
  }

  @Get('comments')
  listComments(@Query() query: CommentListQueryDto, @CurrentUser() user: AuthUser) {
    return this.comments.list(query, user);
  }

  @Post('comments')
  createComment(@Body() dto: CreateCommentDto, @CurrentUser() user: AuthUser) {
    return this.comments.create(dto, user);
  }
}
