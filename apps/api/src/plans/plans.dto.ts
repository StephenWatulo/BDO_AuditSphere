import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { EngagementType, ManagementRequestStatus, PlanItemSource, PlanItemStatus, PlanStatus, RiskRating, TaskPriority } from '@auditsphere/db';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsISO8601, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';
import { PaginationDto } from '../common/pagination';

export class PlanListQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: PlanStatus }) @IsOptional() @IsEnum(PlanStatus) status?: PlanStatus;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() fiscalYear?: number;
}

export class CreatePlanDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(200) title: string;
  @ApiProperty({ example: 2026 }) @IsInt() @Min(2000) @Max(2100) fiscalYear: number;
  @ApiPropertyOptional({ default: 1 }) @IsOptional() @IsInt() @Min(1) @Max(5) horizonYears?: number;
  @ApiProperty() @IsISO8601() startDate: string;
  @ApiProperty() @IsISO8601() endDate: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) totalBudgetHours?: number | null;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) totalBudgetAmount?: number | null;
  @ApiPropertyOptional({ default: 'USD' }) @IsOptional() @IsString() @MaxLength(3) currency?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20000) narrative?: string;
}

export class UpdatePlanDto extends PartialType(CreatePlanDto) {}

export class CreatePlanItemDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() entityId?: string | null;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(300) title: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(8000) description?: string;
  @ApiPropertyOptional({ enum: PlanItemSource }) @IsOptional() @IsEnum(PlanItemSource) source?: PlanItemSource;
  @ApiPropertyOptional({ enum: EngagementType }) @IsOptional() @IsEnum(EngagementType) engagementType?: EngagementType;
  @ApiPropertyOptional({ enum: RiskRating }) @IsOptional() @IsEnum(RiskRating) riskRating?: RiskRating;
  @ApiPropertyOptional({ minimum: 1, maximum: 5 }) @IsOptional() @IsInt() @Min(1) @Max(5) priority?: number;
  @ApiProperty({ example: 2026 }) @IsInt() @Min(2000) @Max(2100) plannedYear: number;
  @ApiPropertyOptional({ minimum: 1, maximum: 4 }) @IsOptional() @IsInt() @Min(1) @Max(4) plannedQuarter?: number | null;
  @ApiPropertyOptional() @IsOptional() @IsISO8601() plannedStart?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsISO8601() plannedEnd?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) budgetHours?: number | null;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) budgetAmount?: number | null;
  @ApiPropertyOptional() @IsOptional() @IsUUID() leadId?: string | null;
  @ApiPropertyOptional({ enum: PlanItemStatus }) @IsOptional() @IsEnum(PlanItemStatus) status?: PlanItemStatus;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(8000) rationale?: string;
}

export class UpdatePlanItemDto extends PartialType(CreatePlanItemDto) {}

export class ManagementRequestListQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: ManagementRequestStatus }) @IsOptional() @IsEnum(ManagementRequestStatus) status?: ManagementRequestStatus;
  @ApiPropertyOptional() @IsOptional() @IsUUID() entityId?: string;
}

export class CreateManagementRequestDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(300) title: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(8000) description?: string;
  @ApiPropertyOptional({ description: 'Free-text requester when not a platform user' }) @IsOptional() @IsString() @MaxLength(160) requesterName?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() entityId?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsUUID() planItemId?: string | null;
  @ApiPropertyOptional({ enum: TaskPriority }) @IsOptional() @IsEnum(TaskPriority) priority?: TaskPriority;
}

export class UpdateManagementRequestDto extends PartialType(CreateManagementRequestDto) {
  @ApiPropertyOptional({ enum: ManagementRequestStatus }) @IsOptional() @IsEnum(ManagementRequestStatus) status?: ManagementRequestStatus;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000) decisionNote?: string;
}
