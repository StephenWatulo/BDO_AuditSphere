import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { AvailabilityType, TimesheetStatus } from '@auditsphere/db';
import { IsBoolean, IsEnum, IsISO8601, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';
import { PaginationDto } from '../common/pagination';
import { ToBoolean } from '../common/utils';

export class TimesheetListQueryDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  mine?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional({ enum: TimesheetStatus })
  @IsOptional()
  @IsEnum(TimesheetStatus)
  status?: TimesheetStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  weekStart?: string;
}

export class CurrentTimesheetDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  weekStart?: string;
}

export class CreateTimeEntryDto {
  @ApiProperty()
  @IsISO8601()
  date: string;

  @ApiProperty()
  @IsUUID()
  chargeCodeId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  engagementId?: string | null;

  @ApiProperty()
  @IsNumber()
  @Min(0.25)
  @Max(24)
  hours: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string | null;
}

export class UpdateTimeEntryDto extends PartialType(CreateTimeEntryDto) {}

export class RejectTimesheetDto {
  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  reason: string;
}

export class AvailabilityListQueryDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional({ enum: AvailabilityType })
  @IsOptional()
  @IsEnum(AvailabilityType)
  type?: AvailabilityType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  to?: string;
}

export class CreateAvailabilityDto {
  @ApiProperty()
  @IsUUID()
  userId: string;

  @ApiProperty({ enum: AvailabilityType })
  @IsEnum(AvailabilityType)
  type: AvailabilityType;

  @ApiProperty()
  @IsISO8601()
  startDate: string;

  @ApiProperty()
  @IsISO8601()
  endDate: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(24)
  hoursPerDay?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string | null;
}

export class UpdateAvailabilityDto extends PartialType(CreateAvailabilityDto) {}
