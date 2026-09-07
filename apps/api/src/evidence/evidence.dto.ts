import { ApiProperty, ApiPropertyOptional, PartialType, OmitType } from '@nestjs/swagger';
import { EvidenceType } from '@auditsphere/db';
import { IsBoolean, IsEnum, IsISO8601, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { PaginationDto } from '../common/pagination';

export class EvidenceListQueryDto extends PaginationDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() workpaperId?: string;
  @ApiPropertyOptional({ enum: EvidenceType }) @IsOptional() @IsEnum(EvidenceType) type?: EvidenceType;
}

export class CreateEvidenceDto {
  @ApiProperty() @IsUUID() engagementId: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() workpaperId?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsUUID() documentId?: string | null;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(4000) description: string;
  @ApiPropertyOptional({ enum: EvidenceType, default: 'DOCUMENT' }) @IsOptional() @IsEnum(EvidenceType) type?: EvidenceType;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) obtainedFrom?: string;
  @ApiPropertyOptional() @IsOptional() @IsISO8601() obtainedAt?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isSufficient?: boolean | null;
}

export class UpdateEvidenceDto extends PartialType(OmitType(CreateEvidenceDto, ['engagementId'] as const)) {}
