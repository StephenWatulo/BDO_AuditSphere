import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { RoleKey, UserStatus } from '@auditsphere/db';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { PASSWORD_RULES } from '../auth/password';
import { PaginationDto } from '../common/pagination';

export class UserListQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: UserStatus }) @IsOptional() @IsEnum(UserStatus) status?: UserStatus;
  @ApiPropertyOptional({ enum: RoleKey }) @IsOptional() @IsEnum(RoleKey) role?: RoleKey;
}

export class UserOptionsQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: RoleKey }) @IsOptional() @IsEnum(RoleKey) role?: RoleKey;
}

export class UserProfileDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(1) @MaxLength(120) displayName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) firstName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) lastName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) jobTitle?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) officeLocation?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) country?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsUrl({ require_tld: false }) @MaxLength(500) avatarUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) weeklyCapacity?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) chargeRate?: number;
}

export class CreateUserDto extends UserProfileDto {
  @ApiProperty()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  email: string;

  @ApiProperty() @IsString() @MinLength(1) @MaxLength(120) declare displayName: string;

  @ApiProperty({ enum: RoleKey, isArray: true })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(9)
  @IsEnum(RoleKey, { each: true })
  roles: RoleKey[];

  @ApiPropertyOptional({ description: 'Omit to invite the user with a generated temporary password' })
  @IsOptional()
  @IsString()
  @MinLength(PASSWORD_RULES.minLength)
  @MaxLength(PASSWORD_RULES.maxLength)
  @Matches(PASSWORD_RULES.pattern, { message: PASSWORD_RULES.message })
  password?: string;
}

export class UpdateUserDto extends PartialType(UserProfileDto) {
  @ApiPropertyOptional({ enum: UserStatus }) @IsOptional() @IsEnum(UserStatus) status?: UserStatus;
}

export class SetRolesDto {
  @ApiProperty({ enum: RoleKey, isArray: true })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(9)
  @IsEnum(RoleKey, { each: true })
  roles: RoleKey[];
}
