import { ApiPropertyOptional } from '@nestjs/swagger';
import { EngagementStage, EngagementStatus, FindingSeverity, FindingStatus } from '@auditsphere/db';
import { IsEnum, IsIn, IsISO8601, IsOptional, IsUUID } from 'class-validator';
import { PaginationDto } from '../common/pagination';

export const REPORT_FORMATS = ['pdf', 'docx', 'xlsx', 'csv', 'md'] as const;
export type ReportFormat = (typeof REPORT_FORMATS)[number];

export class ExportFormatDto {
  @ApiPropertyOptional({ enum: REPORT_FORMATS, default: 'pdf' })
  @IsOptional()
  @IsIn(REPORT_FORMATS)
  format?: ReportFormat = 'pdf';
}

export class ReportQueryDto extends ExportFormatDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  to?: string;
}

export class FindingRegisterReportQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: REPORT_FORMATS }) @IsOptional() @IsIn(REPORT_FORMATS) format?: ReportFormat;
  @ApiPropertyOptional({ enum: FindingStatus })
  @IsOptional()
  @IsEnum(FindingStatus)
  status?: FindingStatus;

  @ApiPropertyOptional({ enum: FindingSeverity })
  @IsOptional()
  @IsEnum(FindingSeverity)
  severity?: FindingSeverity;
}

export class EngagementRegisterReportQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: REPORT_FORMATS }) @IsOptional() @IsIn(REPORT_FORMATS) format?: ReportFormat;
  @ApiPropertyOptional({ enum: EngagementStage })
  @IsOptional()
  @IsEnum(EngagementStage)
  stage?: EngagementStage;

  @ApiPropertyOptional({ enum: EngagementStatus })
  @IsOptional()
  @IsEnum(EngagementStatus)
  status?: EngagementStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  leadId?: string;
}
