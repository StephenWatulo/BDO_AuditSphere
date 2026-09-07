import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayUnique, IsArray, IsBoolean, IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';
import { DocumentClassification } from '@auditsphere/db';
import { PaginationDto } from '../common/pagination';

export enum AiFeature {
  PlanningScope = 'planning.scope',
  AuditProcedures = 'fieldwork.procedures',
  EvidenceSummary = 'evidence.summary',
  FindingDraft = 'finding.draft',
  ReportSummary = 'report.summary',
  QualityCheck = 'quality.check',
  RiskRadar = 'risk.radar',
  NaturalLanguageSearch = 'search.nl',
}

export class CopilotRequestDto {
  @ApiProperty({ enum: AiFeature })
  @IsEnum(AiFeature)
  feature: AiFeature;

  @ApiProperty({ description: 'Auditor instruction or question' })
  @IsString()
  @MinLength(3)
  @MaxLength(8000)
  prompt: string;

  @ApiPropertyOptional({ description: 'Optional domain object type, e.g. Engagement, Workpaper, Finding, Risk' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  targetType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  targetId?: string;

  @ApiPropertyOptional({ description: 'Extra user-supplied context' })
  @IsOptional()
  @IsString()
  @MaxLength(12000)
  context?: string;

  @ApiPropertyOptional({ type: [String], maxItems: 5 })
  @IsOptional() @IsArray() @ArrayMaxSize(5) @ArrayUnique() @IsUUID('all', { each: true })
  documentIds?: string[];
}

export class UploadAiContextDto {
  @ApiPropertyOptional({ enum: DocumentClassification, default: 'CONFIDENTIAL' })
  @IsOptional() @IsEnum(DocumentClassification)
  classification?: DocumentClassification;
}

export class AiInteractionListQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: AiFeature })
  @IsOptional()
  @IsEnum(AiFeature)
  feature?: AiFeature;
}

export class AiFeedbackDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  accepted?: boolean;

  @ApiPropertyOptional({ minimum: 1, maximum: 5 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;
}

export class UpdateAiInteractionDto extends PartialType(AiFeedbackDto) {}
