import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { EntityType, RiskRating } from '@auditsphere/db';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsISO8601,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { PaginationDto } from '../common/pagination';
import { ToBoolean } from '../common/utils';

export class EntityListQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Return a paged flat list instead of the tree' }) @IsOptional() @ToBoolean() @IsBoolean() flat?: boolean;
  @ApiPropertyOptional({ enum: EntityType }) @IsOptional() @IsEnum(EntityType) type?: EntityType;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) country?: string;
  @ApiPropertyOptional({ enum: RiskRating }) @IsOptional() @IsEnum(RiskRating) riskRating?: RiskRating;
  @ApiPropertyOptional() @IsOptional() @IsUUID() parentId?: string;
  @ApiPropertyOptional() @IsOptional() @ToBoolean() @IsBoolean() includeInactive?: boolean;
}

export class CreateEntityDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() parentId?: string | null;
  @ApiProperty({ enum: EntityType }) @IsEnum(EntityType) type: EntityType;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(40) code: string;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(200) name: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000) description?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() ownerId?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) country?: string;
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @IsString({ each: true }) strategicObjectives?: string[];
  @ApiPropertyOptional({ type: 'array', items: { type: 'object' } }) @IsOptional() @IsArray() regulatoryRequirements?: unknown[];
  @ApiPropertyOptional({ enum: RiskRating }) @IsOptional() @IsEnum(RiskRating) riskRating?: RiskRating;
  @ApiPropertyOptional() @IsOptional() @IsISO8601() lastAuditDate?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsISO8601() nextAuditDue?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) auditFrequencyMonths?: number | null;
  @ApiPropertyOptional({ type: 'object', additionalProperties: true }) @IsOptional() @IsObject() metadata?: Record<string, unknown>;
}

export class UpdateEntityDto extends PartialType(CreateEntityDto) {
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}

export class ProcessListQueryDto extends PaginationDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() entityId?: string;
  @ApiPropertyOptional() @IsOptional() @ToBoolean() @IsBoolean() isKey?: boolean;
}

export class CreateProcessDto {
  @ApiProperty() @IsUUID() entityId: string;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(40) code: string;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(200) name: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000) description?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() ownerId?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) category?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isKey?: boolean;
}

export class UpdateProcessDto extends PartialType(CreateProcessDto) {}
