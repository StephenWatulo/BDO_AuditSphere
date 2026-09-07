import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RequestStatus } from '@auditsphere/db';
import { IsBoolean, IsEmail, IsEnum, IsISO8601, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { PaginationDto } from '../common/pagination';
import { ToBoolean } from '../common/utils';

export class RequestListQueryDto extends PaginationDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() engagementId?: string;
  @ApiPropertyOptional({ enum: RequestStatus }) @IsOptional() @IsEnum(RequestStatus) status?: RequestStatus;
  @ApiPropertyOptional({ description: 'Requests assigned to me' }) @IsOptional() @ToBoolean() @IsBoolean() mine?: boolean;
  @ApiPropertyOptional({ description: 'Open requests past due' }) @IsOptional() @ToBoolean() @IsBoolean() overdue?: boolean;
}

export class CreateRequestDto {
  @ApiProperty() @IsUUID() engagementId: string;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(300) title: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(8000) description?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() assigneeId?: string | null;
  @ApiPropertyOptional({ description: 'External assignee when not a platform user' }) @IsOptional() @IsEmail() assigneeEmail?: string;
  @ApiProperty() @IsISO8601() dueDate: string;
}

export class UpdateRequestDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(1) @MaxLength(300) title?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(8000) description?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() assigneeId?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsEmail() assigneeEmail?: string;
  @ApiPropertyOptional() @IsOptional() @IsISO8601() dueDate?: string;
  @ApiPropertyOptional({ description: 'Response from the business (the only field a responder may edit)' }) @IsOptional() @IsString() @MaxLength(8000) responseNote?: string;
}

export class LinkDocumentDto {
  @ApiProperty() @IsUUID() documentId: string;
}
