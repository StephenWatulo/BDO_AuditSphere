import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { AuditOpinion, EngagementRole, EngagementStage, EngagementStatus, EngagementType, RiskRating } from '@auditsphere/db';
import { IsBoolean, IsEmail, IsEnum, IsInt, IsISO8601, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min, MinLength } from 'class-validator';
import { PaginationDto } from '../common/pagination';
import { ToBoolean } from '../common/utils';

export class EngagementListQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: EngagementStage }) @IsOptional() @IsEnum(EngagementStage) stage?: EngagementStage;
  @ApiPropertyOptional({ enum: EngagementStatus }) @IsOptional() @IsEnum(EngagementStatus) status?: EngagementStatus;
  @ApiPropertyOptional() @IsOptional() @IsUUID() entityId?: string;
  @ApiPropertyOptional({ enum: EngagementType }) @IsOptional() @IsEnum(EngagementType) type?: EngagementType;
  @ApiPropertyOptional() @IsOptional() @IsUUID() leadId?: string;
  @ApiPropertyOptional({ description: 'Engagements where I am lead, manager, partner or team member' }) @IsOptional() @ToBoolean() @IsBoolean() mine?: boolean;
}

export class CreateEngagementDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(300) title: string;
  @ApiProperty({ enum: EngagementType }) @IsEnum(EngagementType) type: EngagementType;
  @ApiPropertyOptional() @IsOptional() @IsUUID() entityId?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(8000) objectives?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(8000) scope?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(8000) outOfScope?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(8000) background?: string;
  @ApiPropertyOptional() @IsOptional() @IsISO8601() periodStart?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsISO8601() periodEnd?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsISO8601() plannedStart?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsISO8601() plannedEnd?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) budgetHours?: number | null;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) budgetAmount?: number | null;
  @ApiPropertyOptional() @IsOptional() @IsUUID() leadId?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsUUID() managerId?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsUUID() partnerId?: string | null;
  @ApiPropertyOptional({ enum: RiskRating }) @IsOptional() @IsEnum(RiskRating) riskRating?: RiskRating;
}

export class UpdateEngagementDto extends PartialType(CreateEngagementDto) {
  @ApiPropertyOptional({ enum: EngagementStatus, description: 'ACTIVE or ON_HOLD; CLOSED/CANCELLED come from transitions' })
  @IsOptional()
  @IsEnum(EngagementStatus)
  status?: EngagementStatus;
  @ApiPropertyOptional({ enum: AuditOpinion }) @IsOptional() @IsEnum(AuditOpinion) opinion?: AuditOpinion;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20000) executiveSummary?: string;
  @ApiPropertyOptional() @IsOptional() @IsISO8601() actualStart?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsISO8601() actualEnd?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsUUID() reportDocumentId?: string | null;
}

export class AddMemberDto {
  @ApiProperty() @IsUUID() userId: string;
  @ApiProperty({ enum: EngagementRole }) @IsEnum(EngagementRole) role: EngagementRole;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) plannedHours?: number;
}

export class CreateStakeholderDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() userId?: string | null;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(160) name: string;
  @ApiPropertyOptional() @IsOptional() @IsEmail() email?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) title?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(160) organisation?: string;
  @ApiProperty({ example: 'Auditee' }) @IsString() @MinLength(1) @MaxLength(60) role: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isPrimary?: boolean;
}

export class CreateMilestoneDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(160) name: string;
  @ApiPropertyOptional({ enum: EngagementStage }) @IsOptional() @IsEnum(EngagementStage) stage?: EngagementStage | null;
  @ApiProperty() @IsISO8601() dueDate: string;
  @ApiPropertyOptional() @IsOptional() @IsISO8601() completedAt?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) sortOrder?: number;
}

export class UpdateMilestoneDto extends PartialType(CreateMilestoneDto) {}
