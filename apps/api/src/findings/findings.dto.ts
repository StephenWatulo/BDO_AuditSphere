import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { FindingSeverity, FindingStatus, RecommendationStatus, RootCauseCategory, TaskPriority } from '@auditsphere/db';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { PaginationDto } from '../common/pagination';
import { ToBoolean } from '../common/utils';

export class FindingListQueryDto extends PaginationDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() engagementId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() entityId?: string;
  @ApiPropertyOptional({ enum: FindingStatus }) @IsOptional() @IsEnum(FindingStatus) status?: FindingStatus;
  @ApiPropertyOptional({ enum: FindingSeverity }) @IsOptional() @IsEnum(FindingSeverity) severity?: FindingSeverity;
  @ApiPropertyOptional() @IsOptional() @IsUUID() actionOwnerId?: string;
  @ApiPropertyOptional({ description: 'Open findings past their due date' }) @IsOptional() @ToBoolean() @IsBoolean() overdue?: boolean;
  @ApiPropertyOptional({ description: 'Findings where I am the action owner' }) @IsOptional() @ToBoolean() @IsBoolean() mine?: boolean;
  @ApiPropertyOptional() @IsOptional() @ToBoolean() @IsBoolean() isRepeat?: boolean;
}

export class CreateFindingDto {
  @ApiProperty() @IsUUID() engagementId: string;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(300) title: string;
  @ApiProperty({ enum: FindingSeverity }) @IsEnum(FindingSeverity) severity: FindingSeverity;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(20000) condition: string;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(20000) criteria: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20000) cause?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20000) impact?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20000) recommendation?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() workpaperId?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsUUID() riskId?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsUUID() controlId?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsUUID() processId?: string | null;
  @ApiPropertyOptional({ description: 'Defaults to the engagement entity' }) @IsOptional() @IsUUID() entityId?: string | null;
  @ApiPropertyOptional({ enum: RootCauseCategory }) @IsOptional() @IsEnum(RootCauseCategory) rootCauseCategory?: RootCauseCategory | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) category?: string;
  @ApiPropertyOptional({ description: 'Earlier finding this one repeats' }) @IsOptional() @IsUUID() repeatOfId?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsUUID() actionOwnerId?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(160) actionOwnerName?: string;
  @ApiPropertyOptional() @IsOptional() @IsEmail() actionOwnerEmail?: string;
  @ApiPropertyOptional() @IsOptional() @IsISO8601() dueDate?: string | null;
}

/** Fields a business owner (finding:respond without finding:manage) may edit. */
export const BUSINESS_OWNER_FIELDS = ['managementResponse', 'actionOwnerId', 'actionOwnerName', 'actionOwnerEmail', 'dueDate'] as const;

export class UpdateFindingDto extends PartialType(CreateFindingDto) {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20000) managementResponse?: string;
  @ApiPropertyOptional({ type: [String], description: 'Replace the linked evidence set' }) @IsOptional() @IsArray() @ArrayMaxSize(200) @IsUUID(undefined, { each: true }) evidenceIds?: string[];
}

export class ExtendFindingDto {
  @ApiProperty() @IsISO8601() dueDate: string;
  @ApiProperty() @IsString() @MinLength(3) @MaxLength(4000) reason: string;
}

export class CreateRecommendationDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(8000) text: string;
  @ApiPropertyOptional({ enum: TaskPriority }) @IsOptional() @IsEnum(TaskPriority) priority?: TaskPriority;
  @ApiPropertyOptional() @IsOptional() @IsUUID() ownerId?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(160) ownerName?: string;
  @ApiPropertyOptional() @IsOptional() @IsISO8601() dueDate?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(8000) actionPlan?: string;
}

export class UpdateRecommendationDto extends PartialType(CreateRecommendationDto) {
  @ApiPropertyOptional({ enum: RecommendationStatus }) @IsOptional() @IsEnum(RecommendationStatus) status?: RecommendationStatus;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(8000) progressNote?: string;
  @ApiPropertyOptional({ minimum: 0, maximum: 100 }) @IsOptional() @Transform(({ value }) => (typeof value === 'string' ? Number(value) : value)) @IsInt() @Min(0) @Max(100) progressPct?: number;
}
