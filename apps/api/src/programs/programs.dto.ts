import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { StepStatus } from '@auditsphere/db';
import { IsEnum, IsInt, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min, MinLength } from 'class-validator';

export class CreateProgramDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(200) title: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000) description?: string;
  @ApiPropertyOptional({ description: 'AUDIT_PROGRAM library item whose sections/steps are copied' }) @IsOptional() @IsUUID() libraryItemId?: string;
}

export class CreateStepDto {
  @ApiProperty({ example: 'Planning' }) @IsString() @MinLength(1) @MaxLength(120) section: string;
  @ApiProperty({ example: 'P.1' }) @IsString() @MinLength(1) @MaxLength(40) reference: string;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(4000) objective: string;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(20000) procedure: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() riskId?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsUUID() controlId?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsUUID() assigneeId?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) estimatedHours?: number | null;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) sortOrder?: number;
}

export class UpdateStepDto extends PartialType(CreateStepDto) {
  @ApiPropertyOptional({ enum: StepStatus }) @IsOptional() @IsEnum(StepStatus) status?: StepStatus;
}
