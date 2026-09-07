import { Module } from '@nestjs/common';
import { CollaborationController } from './collaboration.controller';
import { CommentsService } from './comments.service';
import { TasksService } from './tasks.service';

@Module({
  controllers: [CollaborationController],
  providers: [TasksService, CommentsService],
  exports: [TasksService, CommentsService],
})
export class CollaborationModule {}
