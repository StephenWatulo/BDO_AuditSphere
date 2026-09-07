import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsOptional, IsString, Length, Matches, MaxLength, MinLength } from 'class-validator';
import { PASSWORD_RULES } from '../password';

export class LoginDto {
  @ApiProperty({ example: 'admin@bdo-ea.com' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Admin123!' })
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password: string;

  @ApiPropertyOptional({ description: 'Tenant slug, only needed when the same email exists in several tenants' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  tenantSlug?: string;
}

export class MfaVerifyDto {
  @ApiProperty()
  @IsString()
  @MinLength(10)
  mfaToken: string;

  @ApiProperty({ description: 'TOTP code or recovery code' })
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @Length(6, 12)
  code: string;
}

export class MfaCodeDto {
  @ApiProperty({ description: 'TOTP code (or recovery code when disabling)' })
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @Length(6, 12)
  code: string;
}

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  currentPassword: string;

  @ApiProperty({ minLength: PASSWORD_RULES.minLength })
  @IsString()
  @MinLength(PASSWORD_RULES.minLength)
  @MaxLength(PASSWORD_RULES.maxLength)
  @Matches(PASSWORD_RULES.pattern, { message: PASSWORD_RULES.message })
  newPassword: string;
}

export class EntraStartQueryDto {
  @ApiPropertyOptional({ description: 'Relative path on the web app to return to after sign-in', example: '/dashboard' })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  returnTo?: string;
}
