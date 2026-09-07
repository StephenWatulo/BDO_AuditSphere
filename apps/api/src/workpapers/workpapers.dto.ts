import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReviewNotePriority } from '@auditsphere/db';
import { ArrayMaxSize, IsArray, IsBoolean, IsEnum, IsInt, IsObject, IsOptional, IsString, IsUUID, MaxLength, Min, MinLength } from 'class-validator';

export class CreateWorkpaperDto {
  @ApiProperty({ example: 'B.2.1' }) @IsString() @MinLength(1) @MaxLength(40) reference: string;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(300) title: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(8000) objective?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20000) procedure?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() riskId?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsUUID() controlId?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsUUID() templateId?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsUUID() programStepId?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) sortOrder?: number;
}

export class UpdateWorkpaperDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(1) @MaxLength(40) reference?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(1) @MaxLength(300) title?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(8000) objective?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20000) procedure?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20000) testPerformed?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20000) results?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20000) exceptions?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20000) conclusion?: string | null;
  @ApiPropertyOptional({ type: 'object', additionalProperties: true, description: 'Template-driven sections' }) @IsOptional() @IsObject() content?: Record<string, unknown>;
  @ApiPropertyOptional() @IsOptional() @IsUUID() riskId?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsUUID() controlId?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) sortOrder?: number;
  @ApiPropertyOptional({ description: 'Stored on the version snapshot' }) @IsOptional() @IsString() @MaxLength(500) changeSummary?: string;
}

export class CreateReviewNoteDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(8000) text: string;
  @ApiPropertyOptional({ enum: ReviewNotePriority }) @IsOptional() @IsEnum(ReviewNotePriority) priority?: ReviewNotePriority;
  @ApiPropertyOptional({ description: 'Defaults to the preparer' }) @IsOptional() @IsUUID() assignedToId?: string | null;
}

export class UpdateReviewNoteDto {
  @ApiPropertyOptional({ description: 'Moves OPEN -> ADDRESSED' }) @IsOptional() @IsString() @MaxLength(8000) response?: string;
  @ApiPropertyOptional({ description: 'Moves to CLEARED (raiser or workpaper:review)' }) @IsOptional() @IsBoolean() clear?: boolean;
  @ApiPropertyOptional({ description: 'Reopen a cleared/addressed note (raiser or workpaper:review)' }) @IsOptional() @IsBoolean() reopen?: boolean;
}

export class CreateWorkpaperTemplateDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(160) name: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) category?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @ApiProperty({
    description: 'Ordered sections',
    example: { sections: [{ key: 'purpose', title: 'Purpose', prompt: 'Why is this test performed?', required: true }] },
    type: 'object',
    additionalProperties: true,
  })
  @IsObject()
  structure: Record<string, unknown>;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}

export class ReorderDto {
  @ApiProperty({ type: [String] }) @IsArray() @ArrayMaxSize(500) @IsUUID(undefined, { each: true }) stepIds: string[];
}
