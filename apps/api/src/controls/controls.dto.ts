import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { ControlEffectiveness, ControlFrequency, ControlNature, ControlTestResult, ControlTestType, ControlType } from '@auditsphere/db';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { PaginationDto } from '../common/pagination';
import { ToBoolean } from '../common/utils';

export class ControlListQueryDto extends PaginationDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() processId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() riskId?: string;
  @ApiPropertyOptional({ enum: ControlType }) @IsOptional() @IsEnum(ControlType) type?: ControlType;
  @ApiPropertyOptional({ enum: ControlNature }) @IsOptional() @IsEnum(ControlNature) nature?: ControlNature;
  @ApiPropertyOptional({ enum: ControlEffectiveness }) @IsOptional() @IsEnum(ControlEffectiveness) effectiveness?: ControlEffectiveness;
  @ApiPropertyOptional() @IsOptional() @ToBoolean() @IsBoolean() isKeyControl?: boolean;
}

export class CreateControlDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(40) code: string;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(300) title: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(8000) description?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() processId?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsUUID() ownerId?: string | null;
  @ApiPropertyOptional({ enum: ControlFrequency }) @IsOptional() @IsEnum(ControlFrequency) frequency?: ControlFrequency;
  @ApiPropertyOptional({ enum: ControlType }) @IsOptional() @IsEnum(ControlType) type?: ControlType;
  @ApiPropertyOptional({ enum: ControlNature }) @IsOptional() @IsEnum(ControlNature) nature?: ControlNature;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isKeyControl?: boolean;
  @ApiPropertyOptional({ example: [{ framework: 'COSO', ref: 'CA-1' }], type: 'array', items: { type: 'object' } })
  @IsOptional()
  @IsArray()
  frameworkReferences?: unknown[];
  @ApiPropertyOptional({ type: [String], description: 'Risks mitigated by this control' }) @IsOptional() @IsArray() @IsUUID(undefined, { each: true }) riskIds?: string[];
}

export class UpdateControlDto extends PartialType(CreateControlDto) {
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
  @ApiPropertyOptional({ enum: ControlEffectiveness }) @IsOptional() @IsEnum(ControlEffectiveness) effectiveness?: ControlEffectiveness;
}

export class SetControlRisksDto {
  @ApiProperty({ type: [String] }) @IsArray() @ArrayMaxSize(200) @IsUUID(undefined, { each: true }) riskIds: string[];
}

export class CreateControlTestDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() engagementId?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsUUID() workpaperId?: string | null;
  @ApiProperty({ enum: ControlTestType }) @IsEnum(ControlTestType) testType: ControlTestType;
  @ApiPropertyOptional() @IsOptional() @IsISO8601() periodStart?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsISO8601() periodEnd?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) populationSize?: number | null;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) sampleSize?: number | null;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) exceptions?: number;
  @ApiPropertyOptional({ enum: ControlTestResult }) @IsOptional() @IsEnum(ControlTestResult) result?: ControlTestResult;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(8000) procedure?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(8000) conclusion?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(8000) remediation?: string;
  @ApiPropertyOptional() @IsOptional() @IsISO8601() testedAt?: string | null;
}

export class UpdateControlTestDto extends PartialType(CreateControlTestDto) {}
