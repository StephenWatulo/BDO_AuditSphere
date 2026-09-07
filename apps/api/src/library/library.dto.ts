import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { LibraryItemType, LibraryStatus } from '@auditsphere/db';
import { ArrayMaxSize, IsArray, IsEnum, IsObject, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { PaginationDto } from '../common/pagination';

export class LibraryListQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: LibraryItemType }) @IsOptional() @IsEnum(LibraryItemType) type?: LibraryItemType;
  @ApiPropertyOptional({ enum: LibraryStatus }) @IsOptional() @IsEnum(LibraryStatus) status?: LibraryStatus;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) industry?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(60) tag?: string;
}

export class CreateLibraryItemDto {
  @ApiProperty({ enum: LibraryItemType }) @IsEnum(LibraryItemType) type: LibraryItemType;
  @ApiProperty({ example: 'AP-P2P-001' }) @IsString() @MinLength(1) @MaxLength(60) code: string;
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(300) title: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000) summary?: string;
  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    example: { sections: [{ name: 'Planning', steps: [{ reference: 'P.1', objective: '', procedure: '', estimatedHours: 2 }] }] },
  })
  @IsObject()
  content: Record<string, unknown>;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) industry?: string;
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @ArrayMaxSize(30) @IsString({ each: true }) tags?: string[];
  @ApiPropertyOptional({ type: [String], description: 'FrameworkReference ids' }) @IsOptional() @IsArray() @ArrayMaxSize(100) @IsUUID(undefined, { each: true }) frameworkReferenceIds?: string[];
}

export class UpdateLibraryItemDto extends PartialType(CreateLibraryItemDto) {}

export class LibraryDecisionDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000) comment?: string;
}
