import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { ConnectorType, FindingSeverity, MonitoringAlertStatus, RiskSignalStatus } from '@auditsphere/db';
import { IsBoolean, IsEnum, IsISO8601, IsObject, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { PaginationDto } from '../common/pagination';
import { ToBoolean } from '../common/utils';

export class RiskSignalListQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: RiskSignalStatus })
  @IsOptional()
  @IsEnum(RiskSignalStatus)
  status?: RiskSignalStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  source?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  riskId?: string;
}

export class UpdateRiskSignalDto {
  @ApiPropertyOptional({ enum: RiskSignalStatus })
  @IsOptional()
  @IsEnum(RiskSignalStatus)
  status?: RiskSignalStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  riskId?: string | null;
}

export class MonitoringAlertListQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: MonitoringAlertStatus })
  @IsOptional()
  @IsEnum(MonitoringAlertStatus)
  status?: MonitoringAlertStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  ruleId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  mine?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  from?: string;
}

export class UpdateMonitoringAlertDto {
  @ApiPropertyOptional({ enum: MonitoringAlertStatus })
  @IsOptional()
  @IsEnum(MonitoringAlertStatus)
  status?: MonitoringAlertStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  assigneeId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  findingId?: string | null;
}

export class MonitoringRuleListQueryDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  ruleType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  active?: boolean;
}

export class CreateMonitoringRuleDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(40)
  code: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string | null;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  ruleType: string;

  @ApiProperty()
  @IsObject()
  definition: Record<string, unknown>;

  @ApiPropertyOptional({ enum: FindingSeverity })
  @IsOptional()
  @IsEnum(FindingSeverity)
  severity?: FindingSeverity;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  connectorId?: string | null;
}

export class UpdateMonitoringRuleDto extends PartialType(CreateMonitoringRuleDto) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ConnectorListQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: ConnectorType })
  @IsOptional()
  @IsEnum(ConnectorType)
  type?: ConnectorType;
}
