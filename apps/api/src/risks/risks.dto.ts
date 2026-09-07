import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { RiskRating, RiskStatus, RiskVelocity } from '@auditsphere/db';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { PaginationDto } from '../common/pagination';

export class RiskListQueryDto extends PaginationDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() entityId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() processId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() categoryId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() ownerId?: string;
  @ApiPropertyOptional({ enum: RiskRating }) @IsOptional() @IsEnum(RiskRating) rating?: RiskRating;
  @ApiPropertyOptional({ enum: RiskStatus }) @IsOptional() @IsEnum(RiskStatus) status?: RiskStatus;
}

export class CreateRiskDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(40) code: string;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(300) title: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(8000) description?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() categoryId?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsUUID() entityId?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsUUID() processId?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsUUID() ownerId?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) source?: string;
  @ApiPropertyOptional({ enum: RiskStatus }) @IsOptional() @IsEnum(RiskStatus) status?: RiskStatus;
  @ApiPropertyOptional({ minimum: 1, maximum: 5 }) @IsOptional() @IsInt() @Min(1) @Max(5) inherentLikelihood?: number;
  @ApiPropertyOptional({ minimum: 1, maximum: 5 }) @IsOptional() @IsInt() @Min(1) @Max(5) inherentImpact?: number;
  @ApiPropertyOptional({ minimum: 1, maximum: 5, description: '1 = no effective controls, 5 = fully effective' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  controlEffectiveness?: number;
  @ApiPropertyOptional({ enum: RiskVelocity }) @IsOptional() @IsEnum(RiskVelocity) velocity?: RiskVelocity;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) appetiteThreshold?: number | null;
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[];
}

export class UpdateRiskDto extends PartialType(CreateRiskDto) {}

export class AssessRiskDto {
  @ApiProperty({ example: 'FY2026-Q1' }) @IsString() @MinLength(1) @MaxLength(40) periodLabel: string;
  @ApiProperty({ minimum: 1, maximum: 5 }) @IsInt() @Min(1) @Max(5) inherentLikelihood: number;
  @ApiProperty({ minimum: 1, maximum: 5 }) @IsInt() @Min(1) @Max(5) inherentImpact: number;
  @ApiProperty({ minimum: 1, maximum: 5 }) @IsInt() @Min(1) @Max(5) controlEffectiveness: number;
  @ApiProperty({ enum: RiskVelocity }) @IsEnum(RiskVelocity) velocity: RiskVelocity;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(8000) rationale?: string;
  @ApiPropertyOptional({ description: 'Scoring model to use; defaults to the tenant default' }) @IsOptional() @IsUUID() scoringModelId?: string;
}

export class CreateRiskCategoryDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(40) code: string;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(120) name: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) weight?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) colour?: string;
}

export class CreateScoringModelDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(120) name: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isDefault?: boolean;
  @ApiProperty({ description: 'Labelled 1-5 anchors', type: 'array', items: { type: 'object' } }) @IsArray() likelihoodScale: unknown[];
  @ApiProperty({ description: 'Labelled 1-5 anchors', type: 'array', items: { type: 'object' } }) @IsArray() impactScale: unknown[];
  @ApiPropertyOptional({ example: { likelihood: 1, impact: 1, velocity: 0.25 } }) @IsOptional() @IsObject() weights?: Record<string, number>;
  @ApiPropertyOptional({ example: { LOW: 5, MEDIUM: 10, HIGH: 16, CRITICAL: 25 } }) @IsOptional() @IsObject() thresholds?: Record<string, number>;
  @ApiPropertyOptional({ type: 'object', additionalProperties: true }) @IsOptional() @IsObject() appetite?: Record<string, unknown>;
}

export class UpdateScoringModelDto extends PartialType(CreateScoringModelDto) {}
