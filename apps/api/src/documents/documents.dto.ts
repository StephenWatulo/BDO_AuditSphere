import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DocumentClassification } from '@auditsphere/db';
import { Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import { PaginationDto } from '../common/pagination';

export const DOCUMENT_OWNER_TYPES = ['Engagement', 'Workpaper', 'Finding', 'Recommendation', 'DocumentRequest', 'Evidence', 'LibraryItem', 'AiContext'] as const;
export type DocumentOwnerType = (typeof DOCUMENT_OWNER_TYPES)[number];
export const MAX_DOCUMENT_BYTES = 50 * 1024 * 1024;

export class PresignUploadDto {
  @ApiProperty({ example: 'bank-reconciliation.xlsx' }) @IsString() @MinLength(1) @MaxLength(255) fileName: string;
  @ApiProperty({ example: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  @IsString()
  @Matches(/^[\w.+-]+\/[\w.+-]+$/, { message: 'mimeType must be a valid media type' })
  @MaxLength(150)
  mimeType: string;
  @ApiProperty({ maximum: MAX_DOCUMENT_BYTES }) @IsInt() @Min(1) @Max(MAX_DOCUMENT_BYTES) sizeBytes: number;
  @ApiProperty({ enum: DOCUMENT_OWNER_TYPES }) @IsIn(DOCUMENT_OWNER_TYPES) ownerType: DocumentOwnerType;
  @ApiProperty() @IsUUID() ownerId: string;
  @ApiPropertyOptional({ enum: DocumentClassification, default: 'CONFIDENTIAL' }) @IsOptional() @IsEnum(DocumentClassification) classification?: DocumentClassification;
}

export class CompleteUploadDto {
  @ApiPropertyOptional({ description: 'Hex SHA-256 of the uploaded bytes' }) @IsOptional() @IsString() @Matches(/^[0-9a-fA-F]{64}$/) checksumSha256?: string;
}

export class UploadDocumentDto {
  @ApiProperty({ enum: DOCUMENT_OWNER_TYPES }) @IsIn(DOCUMENT_OWNER_TYPES) ownerType: DocumentOwnerType;
  @ApiProperty() @IsUUID() ownerId: string;
  @ApiPropertyOptional({ enum: DocumentClassification }) @IsOptional() @IsEnum(DocumentClassification) classification?: DocumentClassification;
}

export class DocumentListQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: DOCUMENT_OWNER_TYPES }) @IsOptional() @IsIn(DOCUMENT_OWNER_TYPES) ownerType?: DocumentOwnerType;
  @ApiPropertyOptional() @IsOptional() @IsUUID() ownerId?: string;
  @ApiPropertyOptional({ enum: DocumentClassification }) @IsOptional() @IsEnum(DocumentClassification) classification?: DocumentClassification;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) minSizeBytes?: number;
}
