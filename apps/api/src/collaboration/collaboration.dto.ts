import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { TaskPriority, TaskStatus } from '@auditsphere/db';
import { ArrayMaxSize, IsArray, IsBoolean, IsEnum, IsISO8601, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { PaginationDto } from '../common/pagination';
import { ToBoolean } from '../common/utils';

export class TaskListQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Tasks assigned to me' }) @IsOptional() @ToBoolean() @IsBoolean() mine?: boolean;
  @ApiPropertyOptional({ enum: TaskStatus }) @IsOptional() @IsEnum(TaskStatus) status?: TaskStatus;
  @ApiPropertyOptional() @IsOptional() @IsUUID() engagementId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() assigneeId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(60) targetType?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() targetId?: string;
}

export class CreateTaskDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() engagementId?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(60) targetType?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() targetId?: string | null;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(300) title: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(8000) description?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() assigneeId?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsISO8601() dueDate?: string | null;
  @ApiPropertyOptional({ enum: TaskPriority }) @IsOptional() @IsEnum(TaskPriority) priority?: TaskPriority;
}

export class UpdateTaskDto extends PartialType(CreateTaskDto) {
  @ApiPropertyOptional({ enum: TaskStatus }) @IsOptional() @IsEnum(TaskStatus) status?: TaskStatus;
}

export class CommentListQueryDto extends PaginationDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(60) targetType: string;
  @ApiProperty() @IsUUID() targetId: string;
}

export class CreateCommentDto {
  @ApiProperty({ example: 'Finding' }) @IsString() @MinLength(1) @MaxLength(60) targetType: string;
  @ApiProperty() @IsUUID() targetId: string;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(20000) body: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() parentId?: string | null;
  @ApiPropertyOptional({ description: 'Internal comments are hidden from business users', default: true }) @IsOptional() @IsBoolean() isInternal?: boolean;
  @ApiPropertyOptional({ type: [String], description: 'User ids mentioned' }) @IsOptional() @IsArray() @ArrayMaxSize(50) @IsUUID(undefined, { each: true }) mentions?: string[];
}
